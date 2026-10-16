// Tipos y utilidades del catálogo sin dependencias de servidor: se usan también en el cliente.

export type Category = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  icon: string | null;
  price_required: boolean;
  price_period: "total" | "month";
  has_condition: boolean;
};

export type AttributeDef = {
  id: number;
  category_id: number;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options: string[] | null;
  unit: string | null;
  is_required: boolean;
};

export type City = { id: number; name: string };

export type Catalog = {
  categories: Category[];
  attributes: AttributeDef[];
  cities: City[];
};

/** Atributos de una subcategoría: los suyos y los heredados de su categoría principal. */
export function attributesFor(catalog: Catalog, categoryId: number | null): AttributeDef[] {
  if (categoryId === null) return [];
  const category = catalog.categories.find((c) => c.id === categoryId);
  if (!category) return [];
  const ids = new Set([category.id, category.parent_id]);
  return catalog.attributes.filter((a) => ids.has(a.category_id));
}
