import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CHAT_IMAGES_BUCKET, type ChatMessage, type ConversationRole } from "./types";

// Consultas del chat con la sesión del usuario (RLS y RPC security definer). Usar dentro de <Suspense>.

/** Cuánto duran las URLs firmadas de las fotos del chat. */
const SIGNED_URL_SECONDS = 60 * 60;

export async function getConversations(role: ConversationRole | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations", {
    p_role: role ?? undefined,
    p_limit: 100,
  });
  if (error) throw new Error(`my_conversations: ${error.message}`);
  return (data ?? []).map((c) => ({ ...c, role: c.role as ConversationRole }));
}

export type ConversationSummary = Awaited<ReturnType<typeof getConversations>>[number];

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations", { p_conversation_id: id });
  if (error) throw new Error(`my_conversation: ${error.message}`);
  const row = data?.[0];
  return row ? { ...row, role: row.role as ConversationRole } : null;
}

/** Los últimos `limit` mensajes, en orden cronológico, con las fotos ya firmadas. */
export async function getMessages(conversationId: string, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, image_path, created_at")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw new Error(`messages: ${error.message}`);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const messages: ChatMessage[] = rows.slice(0, limit).reverse();

  const paths = messages.flatMap((m) => (m.image_path ? [m.image_path] : []));
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const m of messages) if (m.image_path) m.image_url = urls.get(m.image_path) ?? null;
  }
  return { messages, hasMore };
}

/** Conversación que ya tiene el usuario como comprador con este anuncio, si existe. */
export async function findConversationForListing(listingId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function isWhatsappEnabled(listingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_whatsapp_enabled", { p_listing_id: listingId });
  return data === true;
}
