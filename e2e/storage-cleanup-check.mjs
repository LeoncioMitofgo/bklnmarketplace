// Limpieza de Storage (D-073) en modo prueba: siembra ficheros de cada caso con un usuario propio y
// comprueba qué borraría el cron (/api/cron/daily?dry=1), que no borra nada. Necesita el servidor con
// CRON_SECRET=prueba-local-cron. Al terminar quita sus ficheros y su usuario.
import { randomBytes, randomUUID } from "node:crypto";
import { BASE, crash, createClient, env, finish, ok } from "./lib.mjs";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const LISTINGS = "listing-images";
const MEDIA = "profile-media";
// WebP de 1×1 píxel.
const TINY_WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAAAAAAAAAAAA",
  "base64",
);

const suffix = randomBytes(3).toString("hex");
const ghost = randomUUID(); // carpeta de una cuenta que ya no existe
const planted = { [LISTINGS]: [], [MEDIA]: [] };
let userId;

async function upload(bucket, name) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(name, TINY_WEBP, { contentType: "image/webp" });
  if (error) throw new Error(`upload ${bucket}/${name}: ${error.message}`);
  planted[bucket].push(name);
  return `${bucket}/${name}`;
}

async function listingWithPhoto(status) {
  const { data: listing, error } = await admin
    .from("listings")
    .insert({ user_id: userId, is_negotiable: false })
    .select("id")
    .single();
  if (error) throw new Error(`listing: ${error.message}`);
  const image = randomUUID();
  const base = `${userId}/${listing.id}/${image}`;
  const paths = [
    await upload(LISTINGS, `${base}-l.webp`),
    await upload(LISTINGS, `${base}-t.webp`),
  ];
  const row = await admin.from("listing_images").insert({
    id: image,
    listing_id: listing.id,
    storage_path: base,
    format: "webp",
    width: 1,
    height: 1,
  });
  if (row.error) throw new Error(`listing_images: ${row.error.message}`);
  if (status === "deleted") {
    const deletedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const upd = await admin
      .from("listings")
      .update({ status: "deleted", deleted_at: deletedAt })
      .eq("id", listing.id);
    if (upd.error) throw new Error(`deleted: ${upd.error.message}`);
  }
  return { id: listing.id, paths };
}

try {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `limpieza+${suffix}@bklnmarketplace.com`,
    password: `Prueba-${randomBytes(6).toString("hex")}`,
    email_confirm: true,
    user_metadata: {
      username: `limpieza_${suffix}`,
      display_name: "Limpieza de Prueba",
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  userId = created.user.id;

  // Lo que se usa: foto de un anuncio activo y el avatar.
  const live = await listingWithPhoto("draft");
  const avatar = await upload(MEDIA, `${userId}/avatar-${randomUUID()}.webp`);
  const setAvatar = await admin
    .from("profiles")
    .update({ avatar_path: avatar.slice(MEDIA.length + 1) })
    .eq("id", userId);
  if (setAvatar.error) throw new Error(`avatar: ${setAvatar.error.message}`);
  // Subidas a medias, de hace un momento: se esperan 24 h.
  const fresh = [
    await upload(LISTINGS, `${userId}/${live.id}/${randomUUID()}-l.webp`),
    await upload(MEDIA, `${userId}/avatar-${randomUUID()}.webp`),
  ];
  // Lo que sobra: anuncio borrado hace 40 días, anuncio que no existe y cuenta que no existe.
  const old = await listingWithPhoto("deleted");
  const gone = [
    await upload(LISTINGS, `${userId}/${randomUUID()}/${randomUUID()}-l.webp`),
    await upload(LISTINGS, `${ghost}/${randomUUID()}/${randomUUID()}-l.webp`),
    await upload(MEDIA, `${ghost}/avatar-${randomUUID()}.webp`),
  ];

  const res = await fetch(`${BASE}/api/cron/daily?dry=1`, {
    headers: { Authorization: "Bearer prueba-local-cron" },
  });
  ok("el cron en modo prueba responde", res.ok, String(res.status));
  const { storage } = await res.json();
  const plan = new Set(storage.paths);
  ok("deja las fotos que se usan y el avatar", ![...live.paths, avatar].some((p) => plan.has(p)));
  ok("deja las subidas de hace menos de 24 h", !fresh.some((p) => plan.has(p)));
  ok(
    "borraría las fotos del anuncio borrado hace 40 días",
    old.paths.every((p) => plan.has(p)) && storage.purgedListings >= 1,
  );
  ok(
    "borraría lo de un anuncio y una cuenta que no existen",
    gone.every((p) => plan.has(p)),
  );

  const { data: still } = await admin.storage.from(LISTINGS).list(`${userId}/${old.id}`);
  ok(
    "en modo prueba no borra nada",
    still?.length === 2,
    JSON.stringify(still?.map((f) => f.name)),
  );
  const { count } = await admin
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", old.id);
  ok("…ni las filas de sus fotos", count === 1);
} catch (error) {
  crash(error);
} finally {
  for (const [bucket, names] of Object.entries(planted)) {
    if (names.length) await admin.storage.from(bucket).remove(names);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}
finish();
