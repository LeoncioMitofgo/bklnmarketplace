import "server-only";
import { emailRecipient, waitBetweenEmails } from "@/lib/email/recipient";
import { sendEmail } from "@/lib/email/send";
import { unreadMessagesMessage } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

// Email de respaldo de los mensajes sin leer (ALCANCE §4.6, ARQUITECTURA §5.3, D-076), desde
// /api/cron/unread. Si alguien tiene un mensaje que lleva más de 15 minutos sin leer, recibe un email
// con todas esas conversaciones, como mucho uno por hora. notification_log apunta cada conversación
// con la hora de su último mensaje: un mensaje nuevo vuelve a avisar y uno ya avisado, no.

const MINUTE = 60_000;
const UNREAD_MINUTES = 15;
const EMAIL_EVERY_MINUTES = 60;
/** Solo actividad reciente: lo que lleve días sin leer ya se avisó. */
const LOOKBACK_HOURS = 24;

type Conversation = {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  last_sender_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  buyer_last_read_at: string | null;
  seller_last_read_at: string | null;
};

const ref = (c: Conversation) => `${c.id}:${c.last_message_at}`;
const time = (value: string | null) => (value ? Date.parse(value) : 0);

export async function sendUnreadMessageEmails(
  now = Date.now(),
): Promise<{ users: number; sent: number }> {
  const admin = createAdminClient();
  const cutoff = now - UNREAD_MINUTES * MINUTE;
  const { data: conversations, error } = await admin
    .from("conversations")
    .select(
      "id, listing_id, buyer_id, seller_id, last_sender_id, last_message_at, last_message_preview, buyer_last_read_at, seller_last_read_at",
    )
    .gt("last_message_at", new Date(now - LOOKBACK_HOURS * 60 * MINUTE).toISOString())
    .order("last_message_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`unread_emails: ${error.message}`);

  // Para quién está sin leer cada conversación, y si su primer mensaje sin leer tiene ya 15 minutos.
  const byUser = new Map<string, Conversation[]>();
  for (const c of conversations) {
    const recipient =
      c.last_sender_id === c.buyer_id
        ? c.seller_id
        : c.last_sender_id === c.seller_id
          ? c.buyer_id
          : null;
    if (!recipient || !c.last_message_at) continue;
    const readAt = recipient === c.buyer_id ? c.buyer_last_read_at : c.seller_last_read_at;
    if (time(readAt) >= time(c.last_message_at)) continue;
    if (time(c.last_message_at) > cutoff) {
      // El último es reciente: ¿hay uno anterior, sin leer, de hace más de 15 minutos?
      const { data: older } = await admin
        .from("messages")
        .select("id")
        .eq("conversation_id", c.id)
        .neq("sender_id", recipient)
        .gt("created_at", readAt ?? new Date(0).toISOString())
        .lte("created_at", new Date(cutoff).toISOString())
        .limit(1);
      if (!older?.length) continue;
    }
    byUser.set(recipient, [...(byUser.get(recipient) ?? []), c]);
  }

  let sent = 0;
  for (const [userId, due] of byUser) {
    // Como mucho un email por hora: lo que quede se avisa en la siguiente vuelta.
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "unread_messages")
      .eq("channel", "email")
      .gt("sent_at", new Date(now - EMAIL_EVERY_MINUTES * MINUTE).toISOString());
    if (count) continue;
    const recipient = await emailRecipient(admin, userId);
    if (!recipient) continue;

    // Primero se apunta: las conversaciones ya avisadas, sin mensajes nuevos, no se repiten.
    const { data: logged, error: logError } = await admin
      .from("notification_log")
      .upsert(
        due.map((c) => ({
          user_id: userId,
          kind: "unread_messages" as const,
          ref: ref(c),
          channel: "email",
        })),
        { onConflict: "user_id,kind,ref,channel", ignoreDuplicates: true },
      )
      .select("ref");
    if (logError) {
      console.error("unread_emails_log", logError.message);
      continue;
    }
    const fresh = due.filter((c) => logged.some((r) => r.ref === ref(c)));
    if (!fresh.length) continue;

    const [{ data: senders }, { data: listings }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, display_name")
        .in(
          "id",
          fresh.map((c) => c.last_sender_id ?? ""),
        ),
      admin
        .from("listings")
        .select("id, title")
        .in(
          "id",
          fresh.flatMap((c) => (c.listing_id ? [c.listing_id] : [])),
        ),
    ]);
    if (sent) await waitBetweenEmails();
    try {
      await sendEmail(
        await unreadMessagesMessage(
          recipient.email,
          recipient.name,
          fresh.map((c) => ({
            id: c.id,
            sender: senders?.find((s) => s.id === c.last_sender_id)?.display_name ?? "",
            listing: listings?.find((l) => l.id === c.listing_id)?.title ?? null,
            preview: c.last_message_preview,
          })),
          UNREAD_MINUTES,
        ),
      );
      sent++;
    } catch (sendError) {
      // Que lo intente en la siguiente vuelta: se quita lo apuntado.
      console.error(
        "unread_emails_send",
        sendError instanceof Error ? sendError.message : sendError,
      );
      await admin
        .from("notification_log")
        .delete()
        .eq("user_id", userId)
        .eq("kind", "unread_messages")
        .in(
          "ref",
          logged.map((r) => r.ref),
        );
    }
  }
  return { users: byUser.size, sent };
}
