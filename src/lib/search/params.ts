import {
  type AttributeDef,
  attributesFor,
  type Catalog,
  type Category,
  type City,
} from "@/lib/catalog-types";
import { slugify } from "@/lib/slug";

// Filtros de búsqueda ⇄ parámetros de la URL, en español y legibles:
//   /buscar?q=hilux&categoria=coches&ciudad=bata&precio_max=15000000&marca=Toyota&anio_min=2015&orden=recientes
// Funciones puras: se usan en las páginas de búsqueda y de categoría y se prueban sin servidor.

export const PAGE_SIZE = 20;
/** Como mucho 10 "Ver más" (200 resultados); a partir de ahí se pide afinar la búsqueda. */
export const MAX_PAGES = 10;

export const SORTS = ["relevancia", "recientes", "precio-asc", "precio-desc"] as const;
export type Sort = (typeof SORTS)[number];

const RPC_SORT = {
  relevancia: "relevance",
  recientes: "recent",
  "precio-asc": "price_asc",
  "precio-desc": "price_desc",
} as const satisfies Record<Sort, string>;

export type Range = [number | null, number | null];

export type SearchFilters = {
  q: string;
  category: Category | null;
  city: City | null;
  priceMin: number | null;
  priceMax: number | null;
  condition: "new" | "used" | null;
  /** Atributos de lista o sí/no, por su clave (`brand`, `furnished`). */
  attributes: Record<string, string | boolean>;
  /** Rangos de atributos numéricos, por su clave (`year`, `mileage_km`). */
  ranges: Record<string, Range>;
  sort: Sort;
  pages: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const CONDITIONS = { nuevo: "new", usado: "used" } as const;
const MAX_NUMBER = 1_000_000_000_000;

/** Atributos que se pueden filtrar en la categoría (los de texto libre, no). */
export function filterableAttributes(catalog: Catalog, category: Category | null): AttributeDef[] {
  if (!category) return [];
  return attributesFor(catalog, category.id).filter((a) => a.is_filterable && a.type !== "text");
}

/** Nombre del parámetro de un atributo a partir de su etiqueta: "Año" → "anio", "Baños" → "banios". */
export function attributeParam(attribute: AttributeDef): string {
  return slugify(attribute.label.replace(/ñ/g, "ni").replace(/Ñ/g, "Ni")).replace(/-/g, "_");
}

export function citySlug(city: City): string {
  return city.slug;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** "150.000", "150 000" o "150000" → 150000. Cualquier otra cosa → null. */
function parseAmount(value: string): number | null {
  const digits = value.replace(/[\s.]/g, "");
  if (!/^\d{1,13}$/.test(digits)) return null;
  const number = Number(digits);
  return number <= MAX_NUMBER ? number : null;
}

export function parseSearchParams(
  raw: RawSearchParams,
  catalog: Catalog,
  fixedCategory: Category | null = null,
): SearchFilters {
  const categorySlug = first(raw.categoria);
  const category = fixedCategory ?? catalog.categories.find((c) => c.slug === categorySlug) ?? null;
  const citySlugValue = first(raw.ciudad);
  const city = catalog.cities.find((c) => citySlug(c) === citySlugValue) ?? null;

  let priceMin = parseAmount(first(raw.precio_min));
  let priceMax = parseAmount(first(raw.precio_max));
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const conditionValue = first(raw.estado);
  const condition =
    (!category || category.has_condition) && conditionValue in CONDITIONS
      ? CONDITIONS[conditionValue as keyof typeof CONDITIONS]
      : null;

  const attributes: SearchFilters["attributes"] = {};
  const ranges: SearchFilters["ranges"] = {};
  for (const attribute of filterableAttributes(catalog, category)) {
    const name = attributeParam(attribute);
    if (attribute.type === "select") {
      const value = first(raw[name]);
      if (attribute.options?.includes(value)) attributes[attribute.key] = value;
    } else if (attribute.type === "boolean") {
      if (first(raw[name]) === "si") attributes[attribute.key] = true;
    } else if (attribute.type === "number") {
      const min = parseAmount(first(raw[`${name}_min`]));
      const max = parseAmount(first(raw[`${name}_max`]));
      if (min !== null || max !== null) ranges[attribute.key] = [min, max];
    }
  }

  const sortValue = first(raw.orden);
  const sort = (SORTS as readonly string[]).includes(sortValue)
    ? (sortValue as Sort)
    : "relevancia";
  const pages = Number.parseInt(first(raw.n), 10);

  return {
    q: first(raw.q).slice(0, 100),
    category,
    city,
    priceMin,
    priceMax,
    condition,
    attributes,
    ranges,
    sort,
    pages: Number.isInteger(pages) ? Math.min(Math.max(pages, 1), MAX_PAGES) : 1,
  };
}

/** Parámetros de la URL para unos filtros. Con `omitCategory`, la categoría ya va en la ruta. */
export function toSearchParams(
  filters: SearchFilters,
  catalog: Catalog,
  { omitCategory = false } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category && !omitCategory) params.set("categoria", filters.category.slug);
  if (filters.city) params.set("ciudad", citySlug(filters.city));
  if (filters.priceMin !== null) params.set("precio_min", String(filters.priceMin));
  if (filters.priceMax !== null) params.set("precio_max", String(filters.priceMax));
  if (filters.condition) params.set("estado", filters.condition === "new" ? "nuevo" : "usado");

  for (const attribute of filterableAttributes(catalog, filters.category)) {
    const name = attributeParam(attribute);
    const value = filters.attributes[attribute.key];
    if (value === true) params.set(name, "si");
    else if (typeof value === "string") params.set(name, value);

    const [min, max] = filters.ranges[attribute.key] ?? [null, null];
    if (min !== null) params.set(`${name}_min`, String(min));
    if (max !== null) params.set(`${name}_max`, String(max));
  }

  if (filters.sort !== "relevancia") params.set("orden", filters.sort);
  if (filters.pages > 1) params.set("n", String(filters.pages));
  return params;
}

export function searchHref(
  basePath: string,
  filters: SearchFilters,
  catalog: Catalog,
  options: { omitCategory?: boolean } = {},
): string {
  const query = toSearchParams(filters, catalog, options).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Cuántos filtros hay puestos (para el contador del botón "Filtros"). El texto no cuenta. */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    (filters.category ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0) +
    (filters.condition ? 1 : 0) +
    Object.keys(filters.attributes).length +
    Object.keys(filters.ranges).length
  );
}

/** Argumentos de la RPC search_listings. */
export function toRpcArgs(filters: SearchFilters) {
  const hasAttributes = Object.keys(filters.attributes).length > 0;
  const hasRanges = Object.keys(filters.ranges).length > 0;
  return {
    p_query: filters.q || undefined,
    p_category_id: filters.category?.id,
    p_city_id: filters.city?.id,
    p_price_min: filters.priceMin ?? undefined,
    p_price_max: filters.priceMax ?? undefined,
    p_condition: filters.condition ?? undefined,
    p_attributes: hasAttributes ? filters.attributes : undefined,
    p_ranges: hasRanges ? filters.ranges : undefined,
    p_sort: RPC_SORT[filters.sort],
    p_limit: filters.pages * PAGE_SIZE,
  };
}
