// Dirección de la tienda: /t/<slug> (MODELO-DATOS §3.1). Funciones puras: servidor y cliente.

/** 3–40 caracteres: minúsculas, números y guiones; empieza por letra (igual que el CHECK de stores). */
export const STORE_SLUG_PATTERN = /^[a-z][a-z0-9-]{2,39}$/;

/** Por defecto, el nombre de usuario con los puntos y guiones bajos cambiados por guiones. */
export function defaultStoreSlug(username: string): string {
  return username
    .toLowerCase()
    .replace(/[._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/-+$/, "")
    .slice(0, 40);
}

/** Lo que escribe el usuario → slug: minúsculas, sin tildes, espacios a guiones. */
export function normalizeStoreSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type StoreMediaKind = "logo" | "cover";

/** {user_id}/logo-{uuid}.{webp|jpg} o cover-…: debe coincidir con el trigger stores_check_media. */
export function isStoreMediaPath(path: string, userId: string, kind: StoreMediaKind): boolean {
  return new RegExp(`^${userId}/${kind}-[0-9a-f-]{36}\\.(webp|jpg)$`).test(path);
}
