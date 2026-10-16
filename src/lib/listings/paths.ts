import { slugify } from "@/lib/slug";

// URL pública del anuncio: /anuncio/<título-y-ciudad>-<código> (MODELO-DATOS §3.3).
// Se busca por el código; si el resto no coincide, la ficha redirige a la URL canónica.

const CODE_PATTERN = /^[a-z2-9]{8}$/;

export function listingSlug(code: string, title: string | null, cityName?: string | null): string {
  const words = slugify([title, cityName].filter(Boolean).join(" "));
  return words ? `${words}-${code}` : code;
}

export function listingPath(code: string, title: string | null, cityName?: string | null): string {
  return `/anuncio/${listingSlug(code, title, cityName)}`;
}

/** Código del anuncio a partir del segmento de la URL, o null si no tiene el formato esperado. */
export function parseListingCode(slug: string): string | null {
  const code = slug.slice(slug.lastIndexOf("-") + 1);
  return CODE_PATTERN.test(code) ? code : null;
}
