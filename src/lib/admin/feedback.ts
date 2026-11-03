import "server-only";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AdminActionState } from "./types";

// Lo común de las acciones del panel: el texto ya traducido para el formulario y el cliente con la
// sesión del admin (la RLS y las RPC de admin comprueban el rol en la base de datos).

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

export async function adminFeedback(
  key: string,
  values?: Record<string, string>,
): Promise<AdminActionState> {
  const t = await getTranslations("admin.feedback");
  return { status: "ok", message: t(key, values) };
}

/** Un error de una RPC de admin, una clave de admin.errors o null (error inesperado). */
export async function adminFailure(
  error: { code?: string; message: string } | string | null,
): Promise<AdminActionState> {
  const t = await getTranslations("admin.errors");
  let key = "unexpected";
  if (typeof error === "string") key = error;
  else if (error?.code === "P0001" && RPC_ERRORS.has(error.message)) key = error.message;
  else console.error("admin_error", error?.code, error?.message);
  return { status: "error", message: t(key) };
}

/** Cliente con la sesión, o null sin sesión. */
export async function adminSessionClient() {
  return (await getSessionUser()) ? createClient() : null;
}

/** Igual, pero comprueba antes el rol: la RLS, sin él, solo deja la escritura sin efecto. */
export async function adminClientOrNull() {
  const supabase = await adminSessionClient();
  if (!supabase) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin ? supabase : null;
}
