// Validación de los detalles de un anuncio (paso 3 del asistente). Funciones puras: se prueban sin BD.
// Los errores son claves de i18n bajo listings.errors.

import type { AttributeDef, Category } from "@/lib/catalog-types";

export type AttributeValue = string | number | boolean;

export type DetailsInput = {
  title: string;
  description: string;
  condition: string;
  price: string;
  negotiable: boolean;
  cityId: string;
  neighborhood: string;
  attributes: Record<string, string>;
};

export type ParsedDetails = {
  title: string;
  description: string;
  condition: "new" | "used" | null;
  price_xaf: number | null;
  is_negotiable: boolean;
  city_id: number;
  neighborhood: string | null;
  attributes: Record<string, AttributeValue>;
};

const MAX_PRICE = 1_000_000_000_000;

/** "350.000", "350 000" o "350000" → 350000. Vacío → null. Otra cosa → NaN. */
export function parsePrice(input: string): number | null {
  const value = input.trim();
  if (value === "") return null;
  if (!/^[\d\s.]+$/.test(value)) return Number.NaN;
  const digits = value.replace(/[\s.]/g, "");
  return digits === "" ? Number.NaN : Number(digits);
}

function parseAttribute(def: AttributeDef, raw: string | undefined) {
  const value = (raw ?? "").trim();
  if (def.type === "boolean") return { value: value === "on" };
  if (value === "") return def.is_required ? { error: "attribute_required" } : { value: null };

  if (def.type === "number") {
    const number = parsePrice(value);
    if (number === null || Number.isNaN(number) || number > 1_000_000_000) {
      return { error: "attribute_number" };
    }
    return { value: number };
  }
  if (def.type === "select") {
    return def.options?.includes(value) ? { value } : { error: "attribute_option" };
  }
  return value.length > 60 ? { error: "attribute_length" } : { value };
}

export function validateDetails(
  input: DetailsInput,
  category: Category,
  attributeDefs: AttributeDef[],
  cityIds: Set<number>,
): { data?: ParsedDetails; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const title = input.title.trim();
  if (title.length < 5 || title.length > 80) errors.title = "title_length";

  const description = input.description.trim();
  if (description.length === 0) errors.description = "description_required";
  else if (description.length > 4000) errors.description = "description_length";

  let condition: ParsedDetails["condition"] = null;
  if (category.has_condition) {
    if (input.condition === "new" || input.condition === "used") condition = input.condition;
    else errors.condition = "condition_required";
  }

  const price = parsePrice(input.price);
  if (price === null) {
    if (category.price_required) errors.price = "price_required";
  } else if (Number.isNaN(price) || price > MAX_PRICE) {
    errors.price = "price_format";
  }

  const cityId = Number(input.cityId);
  if (!cityIds.has(cityId)) errors.cityId = "city_required";

  const neighborhood = input.neighborhood.trim();
  if (neighborhood.length > 80) errors.neighborhood = "neighborhood_length";

  const attributes: Record<string, AttributeValue> = {};
  for (const def of attributeDefs) {
    const result = parseAttribute(def, input.attributes[def.key]);
    if ("error" in result && result.error) errors[`attr_${def.key}`] = result.error;
    else if ("value" in result && result.value !== null && result.value !== undefined) {
      attributes[def.key] = result.value;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    data: {
      title,
      description,
      condition,
      price_xaf: price === null || Number.isNaN(price) ? null : price,
      is_negotiable: input.negotiable,
      city_id: cityId,
      neighborhood: neighborhood || null,
      attributes,
    },
  };
}
