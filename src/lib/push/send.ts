import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Envío de notificaciones push web (ARQUITECTURA §5.3) con las claves VAPID del servidor.

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey);
  if (configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "https://www.bklnmarketplace.com",
      publicKey as string,
      privateKey as string,
    );
  } else {
    console.warn("push_disabled: faltan las claves VAPID");
  }
  return configured;
}

/**
 * Envía el aviso a todos los dispositivos del usuario. Las suscripciones caducadas
 * (404/410) se borran. Nunca lanza: un aviso que no sale no debe romper nada.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  let delivered = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "high", topic: payload.tag?.slice(0, 32) },
        );
        delivered++;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push_error", status, (error as Error).message);
        }
      }
    }),
  );
  return delivered;
}
