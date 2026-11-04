// Qué ficheros de Storage sobran (D-073). Separado de la red para poder probarlo.

import { LISTING_IMAGES_BUCKET } from "@/lib/listings/images";
import { PROFILE_MEDIA_BUCKET } from "@/lib/profile-media";

/** Las fotos de un anuncio borrado se guardan este tiempo por si hay que revisar una denuncia. */
export const DELETED_LISTING_DAYS = 30;
/** Un fichero sin uso más reciente puede ser una subida a medias (el 3G se corta entre subir y guardar). */
export const ORPHAN_GRACE_HOURS = 24;

const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StoredObject = { bucket: string; name: string };

export type CleanupInput = {
  objects: StoredObject[];
  /** Usuarios con perfil (de los que tienen carpeta). */
  profiles: Set<string>;
  /** Anuncios que existen (de los que tienen carpeta), con su estado. */
  listings: Map<string, { status: string; deletedAt: string | null }>;
  /** Ficheros que usa la web, como `bucket/nombre`: fotos de listing_images, avatar, logo y portada. */
  inUse: Set<string>;
  now: number;
};

export type CleanupPlan = {
  /** Se borran ya: su cuenta o su anuncio no existen, o el anuncio se borró hace más de 30 días. */
  remove: StoredObject[];
  /** Anuncios borrados hace más de 30 días: también sobran sus filas de listing_images. */
  purgedListings: string[];
  /** Sin uso: se borran solo si tienen más de 24 h. */
  orphans: StoredObject[];
};

export const isUuid = (value: string | undefined): value is string =>
  value !== undefined && UUID.test(value);

/** Anuncio de una foto: `{usuario}/{anuncio}/{foto}-l.webp`. */
export function listingOf(object: StoredObject): string | undefined {
  if (object.bucket !== LISTING_IMAGES_BUCKET) return undefined;
  const parts = object.name.split("/");
  return parts.length === 3 && isUuid(parts[1]) ? parts[1] : undefined;
}

export function planCleanup(input: CleanupInput): CleanupPlan {
  const plan: CleanupPlan = { remove: [], purgedListings: [], orphans: [] };
  const purged = new Set<string>();
  const cutoff = input.now - DELETED_LISTING_DAYS * DAY;
  for (const object of input.objects) {
    const parts = object.name.split("/");
    const owner = parts[0];
    // Solo se tocan las rutas que crea la web; cualquier otra cosa se deja como está.
    const known =
      isUuid(owner) &&
      ((object.bucket === LISTING_IMAGES_BUCKET && listingOf(object)) ||
        (object.bucket === PROFILE_MEDIA_BUCKET && parts.length === 2));
    if (!known) continue;

    if (!input.profiles.has(owner)) {
      plan.remove.push(object);
      continue;
    }
    const listingId = listingOf(object);
    if (listingId) {
      const listing = input.listings.get(listingId);
      if (!listing) {
        plan.remove.push(object);
        continue;
      }
      if (
        listing.status === "deleted" &&
        listing.deletedAt &&
        Date.parse(listing.deletedAt) < cutoff
      ) {
        plan.remove.push(object);
        purged.add(listingId);
        continue;
      }
    }
    if (!input.inUse.has(`${object.bucket}/${object.name}`)) plan.orphans.push(object);
  }
  plan.purgedListings = [...purged];
  return plan;
}
