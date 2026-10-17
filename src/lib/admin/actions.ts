"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import { MVP_PAYMENT_METHODS } from "@/lib/premium/offer";
import { profileTag } from "@/lib/profiles";
import { notifyListingBlocked, notifyPremiumActivated } from "@/lib/push/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminActionState } from "./types";

// Acciones del panel (ALCANCE §4.11). Todas pasan por RPC que comprueban el rol de admin en la base
// de datos. Devuelven el texto ya traducido (admin.feedback) para el formulario.

const RPC_ERRORS = new Set([
  "not_admin",
  "premium_invalid",
  "premium_reference_used",
  "user_not_found",
  "reason_required",
  "listing_invalid_transition",
  "report_invalid",
  "report_not_found",
  "target_is_admin",
]);

const isUuid = (value: string) => /^[0-9a-f-]{36}$/.test(value);
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function feedback(key: string, values?: Record<string, string>): Promise<AdminActionState> {
  const t = await getTranslations("admin.feedback");
  return { status: "ok", message: t(key, values) };
}

async function failure(
  error: { code?: string; message: string } | string | null,
): Promise<AdminActionState> {
  const t = await getTranslations("admin.errors");
  let key = "unexpected";
  if (typeof error === "string") key = error;
  else if (error?.code === "P0001" && RPC_ERRORS.has(error.message)) key = error.message;
  else console.error("admin_error", error?.code, error?.message);
  return { status: "error", message: t(key) };
}

async function sessionClient() {
  return (await getSessionUser()) ? createClient() : null;
}

/** Registra un cobro y activa o amplía Premium (ALCANCE §5.3, paso 4). */
export async function activatePremium(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await sessionClient();
  if (!supabase) return failure("not_admin");
  const userId = text(formData, "userId");
  const months = Number.parseInt(text(formData, "months"), 10);
  const amount = Number.parseInt(text(formData, "amount").replace(/\D/g, ""), 10);
  const method = MVP_PAYMENT_METHODS.find((m) => m === text(formData, "method"));
  const reference = text(formData, "reference");
  if (
    !isUuid(userId) ||
    !Number.isInteger(months) ||
    !Number.isInteger(amount) ||
    !method ||
    !reference
  ) {
    return failure("premium_invalid");
  }

  const { data: until, error } = await supabase.rpc("admin_activate_premium", {
    p_user_id: userId,
    p_months: months,
    p_amount_xaf: amount,
    p_method: method,
    p_reference: reference,
    p_notes: text(formData, "notes") || undefined,
  });
  if (error || !until) return failure(error);

  // La insignia y los destacados salen en las tarjetas y en el perfil público.
  updateTag(LISTINGS_TAG);
  const username = text(formData, "username");
  if (username) updateTag(profileTag(username));
  after(() => notifyPremiumActivated(userId, until));
  refresh();
  const format = await getFormatter();
  return feedback("premiumActivated", {
    date: format.dateTime(new Date(until), { dateStyle: "short" }),
  });
}

/**
 * Moderar un anuncio desde su ficha del panel. Un solo formulario con tres botones (intent):
 * bloquear (motivo obligatorio, lo ve el vendedor), restaurar (motivo obligatorio) o descartar
 * las denuncias abiertas sin tocar el anuncio (el motivo hace de nota).
 */
export async function moderateListing(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await sessionClient();
  if (!supabase) return failure("not_admin");
  const listingId = text(formData, "listingId");
  const reason = text(formData, "reason");
  const intent = text(formData, "intent");
  if (!isUuid(listingId)) return failure(null);

  if (intent === "block" || intent === "restore") {
    const { error } = await supabase.rpc(
      intent === "block" ? "admin_block_listing" : "admin_restore_listing",
      { p_listing_id: listingId, p_reason: reason },
    );
    if (error) return failure(error);
    updateTag(LISTINGS_TAG);
    if (intent === "block") after(() => notifyListingBlocked(listingId, reason));
    refresh();
    return feedback(intent === "block" ? "listingBlocked" : "listingRestored");
  }

  if (intent === "dismiss") {
    const { data: open } = await supabase
      .from("reports")
      .select("id")
      .eq("listing_id", listingId)
      .eq("status", "open");
    for (const report of open ?? []) {
      const { error } = await supabase.rpc("admin_close_report", {
        p_report_id: report.id,
        p_status: "dismissed",
        p_note: reason || undefined,
      });
      if (error) return failure(error);
    }
    refresh();
    return feedback("reportsDismissed");
  }
  return failure(null);
}

export async function closeReport(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await sessionClient();
  if (!supabase) return failure("not_admin");
  const reportId = text(formData, "reportId");
  const status = text(formData, "intent") === "resolved" ? "resolved" : "dismissed";
  if (!isUuid(reportId)) return failure(null);

  const { error } = await supabase.rpc("admin_close_report", {
    p_report_id: reportId,
    p_status: status,
    p_note: text(formData, "note") || undefined,
  });
  if (error) return failure(error);
  refresh();
  return feedback(status === "resolved" ? "reportResolved" : "reportDismissed");
}

/** Suspender unos días (0 = quitar la suspensión). */
export async function suspendUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await sessionClient();
  if (!supabase) return failure("not_admin");
  const userId = text(formData, "userId");
  const days = Number.parseInt(text(formData, "days"), 10);
  if (!isUuid(userId) || !Number.isInteger(days)) return failure(null);

  const { error } = await supabase.rpc("admin_suspend_user", {
    p_user_id: userId,
    p_days: days,
    p_reason: text(formData, "reason"),
  });
  if (error) return failure(error);
  refresh();
  return feedback(days === 0 ? "unsuspended" : "suspended", { days: String(days) });
}

/**
 * Banear o quitar el baneo. La base de datos bloquea sus anuncios; aquí además se corta (o se
 * devuelve) su acceso en Supabase Auth, que solo puede tocar el servidor con la clave secreta.
 */
export async function setBanned(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await sessionClient();
  if (!supabase) return failure("not_admin");
  const userId = text(formData, "userId");
  const banned = text(formData, "banned") === "1";
  if (!isUuid(userId)) return failure(null);

  const { error } = await supabase.rpc("admin_set_banned", {
    p_user_id: userId,
    p_banned: banned,
    p_reason: text(formData, "reason"),
  });
  if (error) return failure(error);

  // La RPC ya ha comprobado que quien lo pide es admin.
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: banned ? "87600h" : "none",
  });
  if (authError) console.error("admin_auth_ban", authError.message);

  updateTag(LISTINGS_TAG);
  const username = text(formData, "username");
  if (username) updateTag(profileTag(username));
  refresh();
  return feedback(banned ? "banned" : "unbanned");
}
