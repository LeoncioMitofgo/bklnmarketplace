import "server-only";
import { type ImageFormat, imageFileName, LISTING_IMAGES_BUCKET } from "@/lib/listings/images";
import { PROFILE_MEDIA_BUCKET } from "@/lib/profile-media";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isUuid,
  listingOf,
  ORPHAN_GRACE_HOURS,
  planCleanup,
  type StoredObject,
} from "./cleanup-plan";

// Limpieza diaria de Storage (D-073), desde /api/cron/daily: fotos de anuncios borrados hace más de
// 30 días, ficheros de cuentas y anuncios que ya no existen, y subidas que nunca se guardaron. Las
// fotos del chat no se tocan: los mensajes no se borran.
//
// Primero se lista Storage y después se lee la base de datos: lo que se suba entretanto no está en
// la lista. Cualquier error de lectura para la limpieza entera, para no borrar por falta de datos.

type Db = ReturnType<typeof createAdminClient>;
type Result<T> = { data: T[] | null; error: { message: string } | null };

const BUCKETS = [LISTING_IMAGES_BUCKET, PROFILE_MEDIA_BUCKET];
// Máximo de filas por respuesta de Supabase y de ficheros por llamada a Storage.
const PAGE = 1000;
// Los .in() van por tandas para no llegar a ese máximo.
const CHUNK = 100;
const IMAGES_CHUNK = 25; // hasta 30 fotos por anuncio (límite de plans)
const PARALLEL = 5;
// Más de esto en un día (y más de la cuarta parte de todo) no se borra solo: ver el freno de abajo.
const MAX_REMOVE = 100;
const MAX_REMOVE_SHARE = 0.25;

export type CleanupResult = {
  users: number;
  objects: number;
  removed: number;
  purgedListings: number;
  /** Solo en la prueba (dryRun): lo que se borraría. */
  paths?: string[];
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function inParallel<T, R>(items: T[], fn: (item: T) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (const group of chunks(items, PARALLEL)) {
    for (const part of await Promise.all(group.map(fn))) out.push(...part);
  }
  return out;
}

function rows<T>({ data, error }: Result<T>, what: string): T[] {
  if (error) throw new Error(`storage_cleanup ${what}: ${error.message}`);
  if ((data?.length ?? 0) >= PAGE) throw new Error(`storage_cleanup ${what}: demasiadas filas`);
  return data ?? [];
}

/** Filas de las tablas para una lista de ids, por tandas. */
const byIds = <T>(
  ids: string[],
  size: number,
  what: string,
  query: (ids: string[]) => PromiseLike<Result<T>>,
) => inParallel(chunks(ids, size), async (part) => rows(await query(part), what));

/** Nombres de una carpeta (ficheros y subcarpetas), con la fecha de los ficheros. */
async function listFolder(db: Db, bucket: string, folder: string) {
  const out: { name: string; createdAt: string | null }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(bucket)
      .list(folder, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`storage_cleanup list ${bucket}/${folder}: ${error.message}`);
    out.push(...data.map((f) => ({ name: f.name, createdAt: f.created_at ?? null })));
    if (data.length < PAGE) return out;
  }
}

/** Ficheros de un usuario en los dos buckets (el mismo RPC que al borrar una cuenta), por páginas. */
async function userObjects(db: Db, userId: string): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .rpc("account_storage_objects", { p_user_id: userId })
      .order("bucket_id")
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`storage_cleanup objects: ${error.message}`);
    out.push(...data.map((o) => ({ bucket: o.bucket_id, name: o.name })));
    if (data.length < PAGE) return out;
  }
}

/** De los ficheros sin uso, los que tienen más de 24 h. Lo que no se encuentre se deja. */
async function oldEnough(db: Db, orphans: StoredObject[], now: number) {
  const cutoff = now - ORPHAN_GRACE_HOURS * 3_600_000;
  const byFolder = new Map<string, StoredObject[]>();
  for (const o of orphans) {
    const key = `${o.bucket}|${o.name.slice(0, o.name.lastIndexOf("/"))}`;
    byFolder.set(key, [...(byFolder.get(key) ?? []), o]);
  }
  return inParallel([...byFolder], async ([key, items]) => {
    const [bucket, folder] = key.split("|");
    const files = new Map((await listFolder(db, bucket, folder)).map((f) => [f.name, f.createdAt]));
    return items.filter((o) => {
      const createdAt = files.get(o.name.slice(folder.length + 1));
      return createdAt ? Date.parse(createdAt) < cutoff : false;
    });
  });
}

export async function cleanupStorage({ dryRun = false, now = Date.now() } = {}) {
  const db = createAdminClient();

  // 1. Carpetas de usuario de los dos buckets y sus ficheros.
  const users = new Set<string>();
  for (const bucket of BUCKETS) {
    for (const entry of await listFolder(db, bucket, "")) {
      if (isUuid(entry.name)) users.add(entry.name);
    }
  }
  const userIds = [...users];
  const objects = await inParallel(userIds, (id) => userObjects(db, id));
  const listingIds = [...new Set(objects.map(listingOf).filter(isUuid))];

  // 2. Lo que dice la base de datos de esos usuarios y anuncios.
  const [profiles, stores, listings] = await Promise.all([
    byIds(userIds, CHUNK, "profiles", (ids) =>
      db.from("profiles").select("id, avatar_path").in("id", ids),
    ),
    byIds(userIds, CHUNK, "stores", (ids) =>
      db.from("stores").select("logo_path, cover_path").in("user_id", ids),
    ),
    byIds(listingIds, CHUNK, "listings", (ids) =>
      db.from("listings").select("id, status, deleted_at").in("id", ids),
    ),
  ]);
  const images = await byIds(
    listings.map((l) => l.id),
    IMAGES_CHUNK,
    "images",
    (ids) => db.from("listing_images").select("storage_path, format").in("listing_id", ids),
  );

  const inUse = new Set<string>();
  for (const i of images) {
    for (const variant of ["large", "thumb"] as const) {
      const name = imageFileName(i.storage_path, variant, i.format as ImageFormat);
      inUse.add(`${LISTING_IMAGES_BUCKET}/${name}`);
    }
  }
  const media = [
    ...profiles.map((p) => p.avatar_path),
    ...stores.flatMap((s) => [s.logo_path, s.cover_path]),
  ];
  for (const path of media) if (path) inUse.add(`${PROFILE_MEDIA_BUCKET}/${path}`);

  // 3. El plan y, de lo que no se usa, solo lo que tiene más de 24 h.
  const plan = planCleanup({
    objects,
    profiles: new Set(profiles.map((p) => p.id)),
    listings: new Map(listings.map((l) => [l.id, { status: l.status, deletedAt: l.deleted_at }])),
    inUse,
    now,
  });
  const remove = [...plan.remove, ...(await oldEnough(db, plan.orphans, now))];
  const result: CleanupResult = {
    users: users.size,
    objects: objects.length,
    removed: remove.length,
    purgedListings: plan.purgedListings.length,
  };
  if (dryRun) return { ...result, paths: remove.map((o) => `${o.bucket}/${o.name}`) };
  // Freno: tanto de golpe huele a fallo de lectura. No se borra nada y el error llega a Sentry.
  if (remove.length > Math.max(MAX_REMOVE, objects.length * MAX_REMOVE_SHARE)) {
    throw new Error(`storage_cleanup: ${remove.length} de ${objects.length} ficheros, sin borrar`);
  }

  // 4. Borrar: primero los ficheros y después las filas de las fotos de los anuncios purgados.
  for (const bucket of BUCKETS) {
    const names = remove.filter((o) => o.bucket === bucket).map((o) => o.name);
    for (const batch of chunks(names, PAGE)) {
      const { error } = await db.storage.from(bucket).remove(batch);
      if (error) throw new Error(`storage_cleanup remove ${bucket}: ${error.message}`);
    }
  }
  for (const ids of chunks(plan.purgedListings, CHUNK)) {
    const { error } = await db.from("listing_images").delete().in("listing_id", ids);
    if (error) throw new Error(`storage_cleanup purge: ${error.message}`);
  }
  return result;
}
