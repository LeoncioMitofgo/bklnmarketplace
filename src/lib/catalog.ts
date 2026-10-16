import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { AttributeDef, Catalog } from "./catalog-types";

export type { AttributeDef, Catalog, Category, City } from "./catalog-types";
export { attributesFor } from "./catalog-types";

// Catálogo (categorías, atributos, ciudades): público y casi estático. Se invalida con la etiqueta "catalog".
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag("catalog");
  cacheLife("days");

  const supabase = createPublicClient();
  const [categories, attributes, cities] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, slug, name, icon, price_required, price_period, has_condition")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("category_attributes")
      .select("id, category_id, key, label, type, options, unit, is_required, is_filterable")
      .order("sort_order"),
    supabase
      .from("cities")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);

  if (categories.error || attributes.error || cities.error) {
    throw new Error("No se pudo cargar el catálogo");
  }
  return {
    categories: categories.data,
    attributes: attributes.data as AttributeDef[],
    cities: cities.data,
  };
}
