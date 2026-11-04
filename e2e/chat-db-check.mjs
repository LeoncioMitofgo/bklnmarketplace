// Prueba de extremo a extremo de la mensajería (fase 1.4) contra el proyecto dev, con tiempo real.
// Uso: pnpm e2e chat-db-check   (crea y borra sus propios usuarios)
import { randomBytes } from "node:crypto";
import { crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const anon = createClient(url, pub, opts);
const TINY_WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAAAAAAAAAAAA",
  "base64",
);

const errKey = (r) => r.error?.message;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];

async function makeUser(label) {
  const suffix = letters();
  const email = `chat+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `chat_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, pub, opts);
  await client.auth.signInWithPassword({ email, password });
  await client.realtime.setAuth();
  return { id: data.user.id, phone, client };
}

/** Se suscribe a un canal privado y acumula lo que llega. */
async function listen(client, topic, events) {
  const received = [];
  const channel = client.channel(topic, { config: { private: true } });
  for (const event of events)
    channel.on("broadcast", { event }, (m) => received.push({ event, payload: m.payload }));
  const status = await new Promise((resolve) => {
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(s);
    });
    setTimeout(() => resolve("TIMEOUT_LOCAL"), 10000);
  });
  return { received, status, channel };
}

try {
  const seller = await makeUser("Vendedora Chat");
  const buyer = await makeUser("Comprador Chat");
  const outsider = await makeUser("Curiosa Chat");

  const { data: cat } = await admin.from("categories").select("id").eq("slug", "moviles").single();
  const { data: city } = await admin.from("cities").select("id").eq("slug", "malabo").single();
  const { data: listing } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cat.id,
      city_id: city.id,
      title: "Móvil para la prueba del chat",
      description: "Prueba",
      price_xaf: 100000,
      condition: "used",
      attributes: { brand: "Samsung" },
      status: "active",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select("id")
    .single();

  // ─── Iniciar ────────────────────────────────────────────────────────────────
  let r = await buyer.client.rpc("start_conversation", { p_listing_id: listing.id });
  const conversationId = r.data;
  ok("el comprador inicia la conversación", Boolean(conversationId), errKey(r));
  r = await buyer.client.rpc("start_conversation", { p_listing_id: listing.id });
  ok("iniciarla otra vez devuelve la misma", r.data === conversationId);
  r = await seller.client.rpc("start_conversation", { p_listing_id: listing.id });
  ok("la vendedora no puede escribirse en su anuncio", errKey(r) === "own_listing", errKey(r));
  r = await anon.rpc("start_conversation", { p_listing_id: listing.id });
  ok("un visitante no puede iniciar conversaciones", Boolean(r.error));

  r = await buyer.client.rpc("my_conversations", {});
  ok(
    "sin mensajes, la bandeja no la muestra",
    r.data?.length === 0,
    JSON.stringify(r.error ?? r.data),
  );
  r = await buyer.client.rpc("my_conversations", { p_conversation_id: conversationId });
  ok(
    "pero sí se puede abrir por su id",
    r.data?.length === 1 &&
      r.data[0].role === "buyer" &&
      r.data[0].listing_title === "Móvil para la prueba del chat",
  );

  // ─── Tiempo real ────────────────────────────────────────────────────────────
  const sellerConv = await listen(seller.client, `conversation:${conversationId}`, [
    "message",
    "read",
  ]);
  const sellerInbox = await listen(seller.client, `user:${seller.id}`, ["inbox"]);
  const buyerConv = await listen(buyer.client, `conversation:${conversationId}`, [
    "message",
    "read",
  ]);
  const spy = await listen(outsider.client, `conversation:${conversationId}`, ["message", "read"]);
  const spyInbox = await listen(outsider.client, `user:${seller.id}`, ["inbox"]);
  ok(
    "la vendedora se suscribe a la conversación",
    sellerConv.status === "SUBSCRIBED",
    sellerConv.status,
  );
  ok("…y a su canal personal", sellerInbox.status === "SUBSCRIBED", sellerInbox.status);
  console.log(`      (una tercera persona al suscribirse: ${spy.status} / ${spyInbox.status})`);

  r = await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "  Hola, ¿sigue disponible?  ",
  });
  ok(
    "el comprador envía un mensaje",
    r.data?.id > 0 && r.data.body === "Hola, ¿sigue disponible?",
    errKey(r),
  );
  await wait(2500);
  ok(
    "la vendedora lo recibe en tiempo real",
    sellerConv.received.some(
      (m) => m.event === "message" && m.payload.body === "Hola, ¿sigue disponible?",
    ),
  );
  ok(
    "…y su bandeja recibe el aviso",
    sellerInbox.received.some(
      (m) => m.event === "inbox" && m.payload.conversation_id === conversationId,
    ),
  );
  ok(
    "una tercera persona no recibe nada",
    spy.received.length === 0 && spyInbox.received.length === 0,
  );

  r = await seller.client.from("messages").select("body").eq("conversation_id", conversationId);
  ok("la vendedora lee los mensajes", r.data?.length === 1);
  r = await outsider.client.from("messages").select("body").eq("conversation_id", conversationId);
  ok("una tercera persona no", r.data?.length === 0);
  r = await anon.from("messages").select("body");
  ok("un visitante tampoco", (r.data?.length ?? 0) === 0);
  r = await buyer.client
    .from("messages")
    .insert({ conversation_id: conversationId, body: "directo" });
  ok("no se puede insertar sin la RPC", Boolean(r.error));

  r = await seller.client.rpc("unread_count");
  ok("no leídos de la vendedora: 1", r.data === 1, JSON.stringify(r));
  r = await buyer.client.rpc("unread_count");
  ok("no leídos del comprador: 0", r.data === 0);
  r = await seller.client.rpc("my_conversations", {});
  const row = r.data?.[0];
  ok(
    "bandeja de la vendedora: rol, vista previa y no leídos",
    row?.role === "seller" &&
      row.last_message_preview === "Hola, ¿sigue disponible?" &&
      row.unread_count === 1 &&
      row.last_sender_is_me === false,
  );
  r = await seller.client.rpc("my_conversations", { p_role: "buyer" });
  ok("filtro Comprando de la vendedora: vacío", r.data?.length === 0);

  await seller.client.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  await wait(2000);
  r = await seller.client.rpc("unread_count");
  ok("al leer, sus no leídos bajan a 0", r.data === 0);
  ok(
    "el comprador recibe el «Visto»",
    buyerConv.received.some((m) => m.event === "read" && m.payload.reader_id === seller.id),
  );
  r = await buyer.client.rpc("my_conversations", {});
  ok("el comprador ve cuándo leyó la vendedora", Boolean(r.data?.[0]?.other_last_read_at));

  // ─── Validaciones ───────────────────────────────────────────────────────────
  r = await buyer.client.rpc("send_message", { p_conversation_id: conversationId, p_body: "   " });
  ok("mensaje vacío → message_empty", errKey(r) === "message_empty", errKey(r));
  r = await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "x".repeat(2001),
  });
  ok("más de 2000 caracteres → message_too_long", errKey(r) === "message_too_long", errKey(r));
  r = await outsider.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "hola",
  });
  ok("una tercera persona no puede escribir", errKey(r) === "conversation_not_found", errKey(r));
  r = await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_image_path: `${conversationId}/no-existe.webp`,
  });
  ok("foto que no se ha subido → image_invalid", errKey(r) === "image_invalid", errKey(r));

  const imagePath = `${conversationId}/${crypto.randomUUID()}.webp`;
  await admin.storage
    .from("chat-images")
    .upload(imagePath, TINY_WEBP, { contentType: "image/webp" });
  r = await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_image_path: imagePath,
  });
  ok("mensaje con foto", r.data?.image_path === imagePath, errKey(r));
  r = await seller.client.rpc("my_conversations", {});
  ok("vista previa vacía en un mensaje solo con foto", r.data?.[0]?.last_message_preview === null);
  let signed = await seller.client.storage.from("chat-images").createSignedUrl(imagePath, 60);
  ok(
    "la vendedora puede ver la foto (URL firmada)",
    Boolean(signed.data?.signedUrl),
    signed.error?.message,
  );
  signed = await outsider.client.storage.from("chat-images").createSignedUrl(imagePath, 60);
  ok("una tercera persona no", !signed.data?.signedUrl);
  const publicUrl = await fetch(`${url}/storage/v1/object/public/chat-images/${imagePath}`);
  ok("el bucket no es público", publicUrl.status >= 400, String(publicUrl.status));

  // ─── Bloqueos ───────────────────────────────────────────────────────────────
  r = await seller.client.from("blocks").insert({ blocked_id: buyer.id });
  ok("la vendedora bloquea al comprador", !r.error, r.error?.message);
  r = await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "¿Hola?",
  });
  ok("el bloqueado no puede escribir", errKey(r) === "user_blocked", errKey(r));
  r = await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Hola",
  });
  ok("ni quien bloquea, mientras dure el bloqueo", errKey(r) === "user_blocked", errKey(r));
  r = await buyer.client.rpc("my_conversations", {});
  ok("el comprador sabe que está bloqueado", r.data?.[0]?.blocked_me === true);
  r = await seller.client.rpc("my_conversations", {});
  ok("la vendedora ve que lo bloqueó", r.data?.[0]?.blocked_by_me === true);
  r = await buyer.client.from("blocks").select("*");
  ok("el bloqueado no ve la lista de bloqueos de otros", r.data?.length === 0);
  await seller.client.from("blocks").delete().eq("blocked_id", buyer.id);
  r = await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Sí, sigue disponible.",
  });
  ok("tras desbloquear se puede escribir", !r.error, errKey(r));

  // ─── WhatsApp ───────────────────────────────────────────────────────────────
  r = await buyer.client.rpc("listing_whatsapp_enabled", { p_listing_id: listing.id });
  ok("WhatsApp desactivado por defecto", r.data === false);
  r = await seller.client
    .from("profile_private")
    .update({ show_whatsapp: true })
    .eq("user_id", seller.id);
  ok("la vendedora lo activa", !r.error, r.error?.message);
  r = await buyer.client.rpc("listing_whatsapp_enabled", { p_listing_id: listing.id });
  ok("el comprador ve el botón", r.data === true);
  r = await seller.client.rpc("listing_whatsapp_enabled", { p_listing_id: listing.id });
  ok("la vendedora no, en su propio anuncio", r.data === false);
  r = await anon.rpc("listing_whatsapp_enabled", { p_listing_id: listing.id });
  ok("un visitante no puede preguntarlo", Boolean(r.error) || r.data === false);
  r = await buyer.client.rpc("whatsapp_contact", { p_listing_id: listing.id });
  ok("al pulsar, el comprador obtiene el teléfono", r.data === seller.phone, errKey(r));
  r = await anon.rpc("whatsapp_contact", { p_listing_id: listing.id });
  ok("un visitante no", Boolean(r.error));

  // ─── Límite de mensajes por minuto ──────────────────────────────────────────
  let sent = 0;
  let limited = false;
  for (let i = 0; i < 40; i++) {
    const res = await buyer.client.rpc("send_message", {
      p_conversation_id: conversationId,
      p_body: `Mensaje ${i}`,
    });
    if (res.error) {
      limited = res.error.message === "chat_rate_limited";
      break;
    }
    sent++;
  }
  ok("tope de mensajes por minuto (30)", limited && sent <= 30, `enviados ${sent}`);

  // ─── Cuenta borrada ─────────────────────────────────────────────────────────
  r = await admin.rpc("compute_response_times");
  ok("compute_response_times se ejecuta", !r.error, r.error?.message);

  await admin.auth.admin.deleteUser(buyer.id);
  users.splice(users.indexOf(buyer.id), 1);
  r = await seller.client.rpc("my_conversations", {});
  ok(
    "si el comprador borra su cuenta, la conversación sigue",
    r.data?.length === 1 && r.data[0].other_id === null,
  );
  r = await seller.client
    .from("messages")
    .select("sender_id")
    .eq("conversation_id", conversationId);
  ok(
    "…con sus mensajes anonimizados",
    r.data?.some((m) => m.sender_id === null),
  );
  r = await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "¿Sigues ahí?",
  });
  ok("y ya no se le puede escribir", errKey(r) === "recipient_deleted", errKey(r));

  for (const c of [seller, outsider]) await c.client.removeAllChannels();
} catch (error) {
  crash(error);
} finally {
  for (const id of users) {
    const { data: convs } = await admin
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${id},seller_id.eq.${id}`);
    for (const c of convs ?? []) {
      const { data: files } = await admin.storage.from("chat-images").list(c.id);
      if (files?.length)
        await admin.storage.from("chat-images").remove(files.map((f) => `${c.id}/${f.name}`));
      await admin.from("conversations").delete().eq("id", c.id);
    }
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
