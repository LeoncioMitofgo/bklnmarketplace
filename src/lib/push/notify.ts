import "server-only";
import { getTranslations } from "next-intl/server";
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
