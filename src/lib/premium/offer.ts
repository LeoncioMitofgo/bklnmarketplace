import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

// Lo que se ofrece en "Hazte Premium" (ALCANCE §5.3): límites de cada plan, precios por periodo y
// datos de la oficina. Todo sale de la configuración (plans, plan_prices, app_settings), nunca del código.

export type Plan = Pick<
  Database["public"]["Tables"]["plans"]["Row"],
  | "max_active_listings"
  | "max_photos"
  | "listing_duration_days"
  | "auto_renew"
  | "has_store"
  | "is_featured"
>;

import type { PremiumPrice } from "./pricing";

export type { PremiumPrice } from "./pricing";
export type Office = {
  name: string;
  address: string;
  hours: string;
  payments_whatsapp: string;
  agency_beneficiary: string;
};
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

/** Formas de pago del MVP (D-025). La transferencia y Rosa Money llegan en la fase 3. */
export const MVP_PAYMENT_METHODS = ["cash_office", "money_transfer_agency"] as const;

/** Etiqueta de caché de planes y precios: invalidarla si el admin los cambia. */
export const PLANS_TAG = "plans";

export async function getPremiumOffer() {
  "use cache";
  cacheTag(PLANS_TAG, "app-settings");
  cacheLife("hours");

  const supabase = createPublicClient();
  const [plans, prices, office] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "id, max_active_listings, max_photos, listing_duration_days, auto_renew, has_store, is_featured",
      )
      .in("id", ["normal", "premium"]),
    supabase
      .from("plan_prices")
      .select("months, price_xaf")
      .eq("plan_id", "premium")
      .eq("is_active", true)
      .order("months"),
    supabase.from("app_settings").select("value").eq("key", "office").single(),
  ]);
  const normal = plans.data?.find((p) => p.id === "normal");
  const premium = plans.data?.find((p) => p.id === "premium");
  if (!normal || !premium || prices.error || office.error) {
    throw new Error("No se pudo cargar la oferta de Premium");
  }
  return {
    normal: normal as Plan,
    premium: premium as Plan,
    prices: prices.data as PremiumPrice[],
    office: office.data.value as Office,
  };
}

export type PremiumOffer = Awaited<ReturnType<typeof getPremiumOffer>>;
