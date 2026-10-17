"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MVP_PAYMENT_METHODS } from "./offer";

// Solicitud de Premium (ALCANCE §5.3, pasos 1–3). Errores: claves bajo premium.errors.

export type PremiumRequestState = { error?: string; values?: { months?: string; method?: string } };

const RPC_ERRORS = new Set(["premium_invalid", "account_restricted"]);

export async function requestPremium(
  _prev: PremiumRequestState,
  formData: FormData,
): Promise<PremiumRequestState> {
  if (!(await getSessionUser())) redirect("/entrar?next=/premium");

  const values = {
    months: String(formData.get("months") ?? ""),
    method: String(formData.get("method") ?? ""),
  };
  const months = Number.parseInt(values.months, 10);
  const method = MVP_PAYMENT_METHODS.find((m) => m === values.method);
  if (!Number.isInteger(months)) return { error: "months_required", values };
  if (!method) return { error: "method_required", values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_premium", { p_months: months, p_method: method });
  if (error) {
    if (error.code === "P0001" && RPC_ERRORS.has(error.message))
      return { error: error.message, values };
    console.error("premium_request", error.code, error.message);
    return { error: "unexpected", values };
  }
  refresh();
  return {};
}

export async function cancelPremiumRequest(): Promise<void> {
  if (!(await getSessionUser())) redirect("/entrar?next=/premium");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_premium_request");
  if (error) console.error("premium_cancel", error.message);
  refresh();
}
