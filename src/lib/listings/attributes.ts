import type { AttributeDef } from "@/lib/catalog-types";
import { formatNumber } from "@/lib/format";

/**
 * Texto de un atributo: "60.000 km", "2018" (los años no llevan separador de miles), "Sí"/"No".
 * Solo se agrupan los miles de los números con unidad (km, m²).
 */
export function attributeText(
  def: Pick<AttributeDef, "unit">,
  value: string | number | boolean,
  labels: { yes: string; no: string },
): string {
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  if (typeof value === "number")
    return def.unit ? `${formatNumber(value)} ${def.unit}` : String(value);
  return value;
}
