"use server";

import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent: string };

/**
 * Guarda la suscripción push de este navegador. Si el mismo móvil ya estaba suscrito con otra
 * cuenta, pasa a la cuenta actual: los avisos van a quien lo está usando.
 */
export async function savePushSubscription(input: SubscriptionInput): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const valid =
    typeof input.endpoint === "string" &&
    input.endpoint.startsWith("https://") &&
    input.endpoint.length <= 1000 &&
    typeof input.p256dh === "string" &&
    input.p256dh.length <= 200 &&
    typeof input.auth === "string" &&
    input.auth.length <= 100;
  if (!valid) return false;

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: String(input.userAgent ?? "").slice(0, 300) || null,
      },
      { onConflict: "endpoint" },
    );
  if (error) console.error("push_subscribe", error.message);
  return !error;
}

/** Quita la suscripción de este navegador (al desactivar avisos o al cerrar sesión). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || typeof endpoint !== "string") return;
  await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
}
