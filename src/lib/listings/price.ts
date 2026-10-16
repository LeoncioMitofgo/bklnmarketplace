import type { Category } from "@/lib/catalog-types";
import { formatXaf } from "@/lib/format";

type Translate = (key: "perMonth" | "onRequest", values?: { price: string }) => string;

/** "150.000 FCFA", "450.000 FCFA/mes" en alquileres o "A consultar" sin precio (ALCANCE §5.6). */
export function priceLabel(
  price: number | null,
  category: Pick<Category, "price_period"> | undefined,
  t: Translate,
): string {
  if (price === null) return t("onRequest");
  const amount = formatXaf(price);
  return category?.price_period === "month" ? t("perMonth", { price: amount }) : amount;
}
