import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "./send";

/**
 * Aviso de mensaje nuevo al otro participante (ALCANCE §4.6: "si el vendedor no se entera, el chat
 * muere"). Respeta su preferencia notify_push. Se llama con after(): no retrasa el envío.
 */
export async function notifyNewMessage(input: {
  conversationId: string;
  senderId: string;
  body: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", input.conversationId)
      .single();
    if (!conversation) return;

    const recipientId =
      conversation.buyer_id === input.senderId ? conversation.seller_id : conversation.buyer_id;
    if (!recipientId) return;

    const [{ data: sender }, { data: settings }, t] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", input.senderId).single(),
      admin.from("profile_private").select("notify_push").eq("user_id", recipientId).single(),
      getTranslations("push"),
    ]);
    if (!settings?.notify_push) return;

    const text = input.body ? input.body.replace(/\s+/g, " ").trim() : t("photo");
    await sendPushToUser(recipientId, {
      title: sender?.display_name ?? t("someone"),
      body: text.length > 140 ? `${text.slice(0, 139)}…` : text,
      url: `/mensajes/${input.conversationId}`,
      // Un aviso por conversación: el nuevo sustituye al anterior en vez de acumularse.
      tag: `c${input.conversationId.replace(/-/g, "").slice(0, 31)}`,
    });
  } catch (error) {
    console.error("notify_new_message", (error as Error).message);
  }
}

/** Solo si el usuario no ha desactivado los avisos (notify_push). */
async function wantsPush(userId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("profile_private")
    .select("notify_push")
    .eq("user_id", userId)
    .single();
  return Boolean(data?.notify_push);
}

/** "Ya eres Premium" al activar o ampliar Premium (ALCANCE §5.3, paso 5). */
export async function notifyPremiumActivated(userId: string, until: string): Promise<void> {
  try {
    if (!(await wantsPush(userId))) return;
    const [t, format] = await Promise.all([getTranslations("notifications"), getFormatter()]);
    await sendPushToUser(userId, {
      title: t("premiumTitle"),
      body: t("premiumBody", { date: format.dateTime(new Date(until), { dateStyle: "short" }) }),
      url: "/cuenta",
      tag: "premium",
    });
  } catch (error) {
    console.error("notify_premium", (error as Error).message);
  }
}

/** Aviso al vendedor cuando el admin bloquea su anuncio (ALCANCE §4.6). */
export async function notifyListingBlocked(listingId: string, reason: string): Promise<void> {
  try {
    const { data: listing } = await createAdminClient()
      .from("listings")
      .select("user_id, title")
      .eq("id", listingId)
      .single();
    if (!listing || !(await wantsPush(listing.user_id))) return;
    const t = await getTranslations("notifications");
    await sendPushToUser(listing.user_id, {
      title: t("blockedTitle"),
      body: t("blockedBody", { title: listing.title ?? "", reason }),
      url: "/mis-anuncios",
      tag: `b${listingId.replace(/-/g, "").slice(0, 31)}`,
    });
  } catch (error) {
    console.error("notify_blocked", (error as Error).message);
  }
}
