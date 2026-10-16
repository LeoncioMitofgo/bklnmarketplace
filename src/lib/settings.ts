import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Ajustes editables (tabla app_settings). Se cachean: cambian muy poco.

export type RateLimits = {
  new_account_days: number;
  login_attempts_per_15_min: number;
  login_attempts_per_15_min_per_ip: number;
  signups_per_hour_per_ip: number;
  password_resets_per_hour: number;
  verification_emails_per_hour: number;
  listings_per_day: number;
  listings_per_day_new_account: number;
  conversations_per_hour: number;
  conversations_per_hour_new_account: number;
  whatsapp_reveals_per_day: number;
};

export async function getRateLimits(): Promise<RateLimits> {
  "use cache";
  cacheTag("app-settings");
  cacheLife("hours");

  const { data, error } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", "rate_limits")
    .single();

  if (error || !data) {
    throw new Error(`No se pudieron leer los límites de app_settings: ${error?.message}`);
  }
  return data.value as RateLimits;
}

/** Días antes de caducar en los que ya se puede renovar un anuncio (ALCANCE §5.1). */
export async function getRenewWindowDays(): Promise<number> {
  "use cache";
  cacheTag("app-settings");
  cacheLife("hours");

  const { data, error } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", "renew_window_days")
    .single();

  if (error || !data) {
    throw new Error(`No se pudo leer renew_window_days: ${error?.message}`);
  }
  return Number(data.value);
}
