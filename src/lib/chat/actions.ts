"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { listingPath } from "@/lib/listings/paths";
import { getPublicListing } from "@/lib/listings/public";
import { notifyNewMessage } from "@/lib/push/notify";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CHAT_IMAGES_BUCKET, type ChatMessage } from "./types";

// Errores: claves bajo chat.errors. Las RPC lanzan P0001 con la clave como mensaje.

export type ChatResult<T> = { ok: true; data: T } | { ok: false; error: string };

const RPC_ERRORS = new Set([
  "not_authenticated",
  "account_restricted",
  "listing_not_available",
  "own_listing",
  "user_blocked",
  "conversation_not_found",
  "recipient_deleted",
  "message_empty",
  "message_too_long",
  "image_invalid",
  "chat_rate_limited",
  "whatsapp_unavailable",
]);

function fail(error: { code?: string; message: string } | null): { ok: false; error: string } {
  if (error?.code === "P0001" && RPC_ERRORS.has(error.message)) {
    return { ok: false, error: error.message };
  }
  console.error("chat_error", error?.code, error?.message);
  return { ok: false, error: "unexpected" };
}

const isUuid = (value: string) => /^[0-9a-f-]{36}$/.test(value);

/** Primer mensaje a un vendedor: crea la conversación (o usa la que ya había) y lo envía. */
export async function startConversation(
  listingId: string,
  body: string,
): Promise<ChatResult<{ conversationId: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!isUuid(listingId)) return { ok: false, error: "listing_not_available" };

  const supabase = await createClient();
  const start = await supabase.rpc("start_conversation", { p_listing_id: listingId });
  if (start.error || !start.data) return fail(start.error);

  const sent = await supabase.rpc("send_message", {
    p_conversation_id: start.data,
    p_body: body,
  });
  if (sent.error) return fail(sent.error);

  const conversationId = start.data;
  after(() => notifyNewMessage({ conversationId, senderId: user.id, body: sent.data.body }));
  return { ok: true, data: { conversationId } };
}

export async function sendMessage(
  conversationId: string,
  body: string | null,
  imagePath: string | null,
): Promise<ChatResult<ChatMessage>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!isUuid(conversationId)) return { ok: false, error: "conversation_not_found" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body ?? undefined,
    p_image_path: imagePath ?? undefined,
  });
  if (error || !data) return fail(error);
  after(() => notifyNewMessage({ conversationId, senderId: user.id, body: data.body }));

  let imageUrl: string | null = null;
  if (data.image_path) {
    const signed = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .createSignedUrl(data.image_path, 3600);
    imageUrl = signed.data?.signedUrl ?? null;
  }
  return {
    ok: true,
    data: {
      id: data.id,
      sender_id: data.sender_id,
      body: data.body,
      image_path: data.image_path,
      created_at: data.created_at,
      image_url: imageUrl,
    },
  };
}

/** URL firmada para subir una foto al chat (los usuarios no escriben en Storage, D-039). */
export async function prepareChatImage(
  conversationId: string,
  format: "webp" | "jpg",
): Promise<ChatResult<{ path: string; signedUrl: string }>> {
  if (!(await getSessionUser())) return { ok: false, error: "not_authenticated" };
  if (!isUuid(conversationId) || (format !== "webp" && format !== "jpg")) {
    return { ok: false, error: "unexpected" };
  }

  // RLS: solo devuelve la conversación si el usuario participa en ella.
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return { ok: false, error: "conversation_not_found" };

  const path = `${conversationId}/${crypto.randomUUID()}.${format}`;
  const { data, error } = await createAdminClient()
    .storage.from(CHAT_IMAGES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("chat_signed_upload", error?.message);
    return { ok: false, error: "unexpected" };
  }
  return { ok: true, data: { path, signedUrl: data.signedUrl } };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!isUuid(conversationId) || !(await getSessionUser())) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) console.error("mark_read", error.message);
}

/** Mensajes sin leer, para el contador de la barra inferior. 0 sin sesión. */
export async function getUnreadCount(): Promise<number> {
  if (!(await getSessionUser())) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_count");
  return data ?? 0;
}

/** Bloquear o desbloquear desde el menú de la conversación. Funciona sin JavaScript. */
export async function setBlocked(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/mensajes/${conversationId}`)}`);

  const blockedId = String(formData.get("userId") ?? "");
  if (!isUuid(blockedId) || blockedId === user.id) return;

  const supabase = await createClient();
  const { error } =
    formData.get("block") === "1"
      ? await supabase.from("blocks").insert({ blocked_id: blockedId })
      : await supabase
          .from("blocks")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", blockedId);
  if (error && error.code !== "23505") console.error("block", error.code, error.message);
  refresh();
}

/**
 * Botón de WhatsApp de la ficha: pide el teléfono (con tope diario) y abre wa.me con un mensaje
 * que incluye el anuncio (ALCANCE §5.4). Sin JavaScript también funciona: es un formulario.
 */
export async function openWhatsApp(
  _previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const code = String(formData.get("code") ?? "");
  const listing = /^[a-z2-9]{8}$/.test(code) ? await getPublicListing(code) : null;
  if (!listing) return { error: "whatsapp_unavailable" };

  const [catalog, t] = await Promise.all([getCatalog(), getTranslations("chat")]);
  const city = catalog.cities.find((c) => c.id === listing.city_id)?.name ?? null;
  const path = listingPath(listing.code, listing.title, city);

  if (!(await getSessionUser())) redirect(`/entrar?next=${encodeURIComponent(path)}`);

  const supabase = await createClient();
  const { data: phone, error } = await supabase.rpc("whatsapp_contact", {
    p_listing_id: listing.id,
  });
  if (error || !phone) {
    const result = fail(error);
    return { error: result.error };
  }

  const text = t("whatsappText", { title: listing.title ?? "", url: `${siteUrl()}${path}` });
  redirect(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`);
}

/** Mostrar u ocultar el botón de WhatsApp en mis anuncios (desactivado por defecto, D-005). */
export async function setShowWhatsapp(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_private")
    .update({ show_whatsapp: formData.get("show") === "1" })
    .eq("user_id", user.id);
  if (error) console.error("show_whatsapp", error.message);
  refresh();
}

// ─── Sin JavaScript ──────────────────────────────────────────────────────────
// Los formularios del chat también funcionan como formularios normales (ARQUITECTURA §1.4).

export async function sendMessageForm(formData: FormData): Promise<void> {
  const conversationId = String(formData.get("conversationId") ?? "");
  await sendMessage(conversationId, String(formData.get("body") ?? ""), null);
  redirect(`/mensajes/${conversationId}#ultimo`);
}

export async function startConversationForm(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  const code = String(formData.get("code") ?? "");
  const result = await startConversation(listingId, String(formData.get("body") ?? ""));
  if (!result.ok && result.error === "not_authenticated") {
    redirect(`/entrar?next=${encodeURIComponent(`/mensajes/anuncio/${code}`)}`);
  }
  redirect(result.ok ? `/mensajes/${result.data.conversationId}` : `/mensajes/anuncio/${code}`);
}
