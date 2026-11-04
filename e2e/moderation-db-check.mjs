// Prueba de extremo a extremo de la fase 1.5 contra el proyecto dev: denuncias, auto‑ocultado,
// denuncia desde el chat con bloqueo, términos prohibidos por palabras y cascada del borrado de cuenta.
// Uso: pnpm e2e moderation-db-check   (crea y borra sus propios usuarios)
import { randomBytes, randomUUID } from "node:crypto";
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
const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
const files = [];

async function makeUser(label) {
  const suffix = letters();
  const email = `moderacion+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `mod_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, pub, opts);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, client };
}

try {
  const seller = await makeUser("Vendedor Denunciado");
  const r1 = await makeUser("Denunciante Uno");
  const r2 = await makeUser("Denunciante Dos");
  const r3 = await makeUser("Denunciante Tres");

  const { data: cat } = await admin.from("categories").select("id").eq("slug", "moviles").single();
  const { data: city } = await admin.from("cities").select("id").eq("slug", "malabo").single();
  const newListing = async (title) => {
    const { data, error } = await admin
      .from("listings")
      .insert({
        user_id: seller.id,
        category_id: cat.id,
        city_id: city.id,
        title,
        description: "Prueba de moderación",
        price_xaf: 50000,
        condition: "used",
        attributes: { brand: "Samsung" },
        status: "active",
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select("id, code")
      .single();
    if (error) throw error;
    return data;
  };
  const listing = await newListing("Móvil sospechoso para denunciar");

  // ─── Denunciar un anuncio ───────────────────────────────────────────────────
  let r = await r1.client.rpc("report_listing", {
    p_listing_id: listing.id,
    p_reason: "scam",
    p_details: "  Pide el pago por adelantado  ",
  });
  ok("denunciar un anuncio → created", r.data === "created", JSON.stringify(r.error ?? r.data));
  r = await r1.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "duplicate" });
  ok("denunciarlo otra vez → already", r.data === "already", JSON.stringify(r.error ?? r.data));
  r = await seller.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  ok("el dueño no puede denunciar su anuncio", errKey(r) === "own_listing", errKey(r));
  r = await anon.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  ok("un visitante no puede denunciar", Boolean(r.error));
  r = await r2.client.rpc("report_listing", {
    p_listing_id: listing.id,
    p_reason: "other",
    p_details: "   ",
  });
  ok("«otro motivo» sin explicación → report_invalid", errKey(r) === "report_invalid", errKey(r));
  r = await r2.client.rpc("report_listing", {
    p_listing_id: listing.id,
    p_reason: "scam",
    p_details: "x".repeat(1001),
  });
  ok(
    "explicación de más de 1000 caracteres → report_invalid",
    errKey(r) === "report_invalid",
    errKey(r),
  );
  r = await r2.client.rpc("report_listing", { p_listing_id: randomUUID(), p_reason: "scam" });
  ok(
    "anuncio inexistente → listing_not_available",
    errKey(r) === "listing_not_available",
    errKey(r),
  );

  const { data: stored } = await admin.from("reports").select("*").eq("listing_id", listing.id);
  ok(
    "se guarda una sola denuncia, con el vendedor y el texto recortado",
    stored?.length === 1 &&
      stored[0].reported_user_id === seller.id &&
      stored[0].details === "Pide el pago por adelantado" &&
      stored[0].status === "open",
    JSON.stringify(stored),
  );

  r = await r2.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "prohibited" });
  ok(
    "segunda denuncia (otro usuario) → created",
    r.data === "created",
    JSON.stringify(r.error ?? r.data),
  );
  let { data: row } = await admin.from("listings").select("status").eq("id", listing.id).single();
  ok("con 2 denuncias sigue activo", row.status === "active", row.status);

  r = await r3.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  ok("tercera denuncia → hidden", r.data === "hidden", JSON.stringify(r.error ?? r.data));
  ({ data: row } = await admin.from("listings").select("status").eq("id", listing.id).single());
  ok("el anuncio pasa a under_review", row.status === "under_review", row.status);
  const { data: publicRow } = await anon
    .from("listings")
    .select("id")
    .eq("id", listing.id)
    .maybeSingle();
  ok("ya no es público", publicRow === null);
  const { data: ownRow } = await seller.client
    .from("listings")
    .select("status")
    .eq("id", listing.id)
    .maybeSingle();
  ok(
    "el vendedor lo sigue viendo en sus anuncios (en revisión)",
    ownRow?.status === "under_review",
  );
  const { data: log } = await admin.from("moderation_log").select("*").eq("target_id", listing.id);
  ok(
    "queda en el registro de moderación como acción del sistema",
    log?.length === 1 && log[0].action === "auto_hide_listing" && log[0].admin_id === null,
    JSON.stringify(log),
  );

  // Una cuarta denuncia sobre un anuncio ya oculto no vuelve a ocultarlo ni duplica el registro.
  const r4 = await makeUser("Denunciante Cuatro");
  r = await r4.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  ok(
    "denunciar uno ya oculto (caché antigua) → created",
    r.data === "created",
    JSON.stringify(r.error ?? r.data),
  );
  const { count: logCount } = await admin
    .from("moderation_log")
    .select("id", { count: "exact", head: true })
    .eq("target_id", listing.id);
  ok("…sin repetir el registro", logCount === 1, String(logCount));

  // ─── RLS ────────────────────────────────────────────────────────────────────
  r = await r1.client.from("reports").select("id, reporter_id");
  ok(
    "cada uno ve solo sus denuncias",
    r.data?.length === 1 && r.data[0].reporter_id === r1.id,
    JSON.stringify(r.data),
  );
  r = await seller.client.from("reports").select("id");
  ok("el denunciado no ve las denuncias", r.data?.length === 0, JSON.stringify(r.data));
  r = await anon.from("reports").select("id");
  ok("un visitante no ve denuncias", !r.data?.length);
  r = await r1.client
    .from("reports")
    .update({ status: "dismissed" })
    .eq("reporter_id", r1.id)
    .select("id");
  ok("un usuario no puede cerrar su denuncia", !r.data?.length);
  r = await r1.client
    .from("reports")
    .insert({ reporter_id: r1.id, reported_user_id: seller.id, reason: "scam" });
  ok("no se puede insertar sin pasar por la RPC", Boolean(r.error));
  r = await r1.client.from("moderation_log").select("id");
  ok("el registro de moderación no se ve sin ser admin", !r.data?.length);

  // ─── Denuncia desde el chat ─────────────────────────────────────────────────
  const listing2 = await newListing("Segundo móvil para el chat");
  r = await r1.client.rpc("start_conversation", { p_listing_id: listing2.id });
  const conversationId = r.data;
  await r1.client.rpc("send_message", { p_conversation_id: conversationId, p_body: "Hola" });
  await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Paga primero por Rosa Money",
  });

  r = await r1.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "duplicate",
  });
  ok(
    "en el chat no vale «anuncio repetido» → report_invalid",
    errKey(r) === "report_invalid",
    errKey(r),
  );
  r = await r2.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "scam",
  });
  ok(
    "quien no participa no puede denunciar la conversación",
    errKey(r) === "conversation_not_found",
    errKey(r),
  );
  r = await r1.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "scam",
    p_details: "Me pide pagar antes",
    p_block: true,
  });
  ok(
    "denunciar al vendedor y bloquearlo → created",
    r.data === "created",
    JSON.stringify(r.error ?? r.data),
  );
  const { data: block } = await r1.client.from("blocks").select("blocked_id");
  ok(
    "…queda bloqueado",
    block?.length === 1 && block[0].blocked_id === seller.id,
    JSON.stringify(block),
  );
  r = await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "¿Hola?",
  });
  ok("…y ya no puede escribirle", errKey(r) === "user_blocked", errKey(r));
  r = await r1.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "offensive",
    p_block: true,
  });
  ok(
    "denunciarlo otra vez → already (y el bloqueo no falla)",
    r.data === "already",
    JSON.stringify(r.error ?? r.data),
  );
  const { data: chatReport } = await admin
    .from("reports")
    .select("*")
    .eq("conversation_id", conversationId);
  ok(
    "la denuncia del chat lleva la conversación y al usuario, sin anuncio",
    chatReport?.length === 1 &&
      chatReport[0].reported_user_id === seller.id &&
      chatReport[0].listing_id === null,
    JSON.stringify(chatReport),
  );
  r = await seller.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "offensive",
  });
  ok(
    "la otra parte también puede denunciar (sin bloquear)",
    r.data === "created",
    JSON.stringify(r.error ?? r.data),
  );
  ({ data: row } = await admin.from("listings").select("status").eq("id", listing2.id).single());
  ok("las denuncias del chat no ocultan el anuncio", row.status === "active", row.status);

  // ─── Términos prohibidos por palabras ───────────────────────────────────────
  const tryTitle = async (title) => {
    const res = await seller.client
      .from("listings")
      .update({ title })
      .eq("id", listing2.id)
      .select("id");
    return res.error ? res.error.message : "ok";
  };
  const cases = [
    ["Vendo escopetas de caza", "listing_banned_term"],
    ["Cocaina pura", "listing_banned_term"],
    ["AK-47 de colección", "listing_banned_term"],
    ["Bolso de MARFIL auténtico", "listing_banned_term"],
    ["Relax y masajes eróticos", "listing_banned_term"],
    ["Billetes   falsos baratos", "listing_banned_term"],
    ["Armario de dos puertas", "ok"],
    ["Pistola de silicona caliente", "ok"],
    ["Camiseta de Gorillaz", "ok"],
    ["Cartuchos de tinta HP", "ok"],
    ["Escopetazo musical (disco)", "ok"],
  ];
  for (const [title, expected] of cases) {
    const got = await tryTitle(title);
    ok(`«${title}» → ${expected}`, got === expected, got);
  }

  // ─── Borrado de cuenta ──────────────────────────────────────────────────────
  const imageId = randomUUID();
  const base = `${seller.id}/${listing2.id}/${imageId}`;
  for (const variant of ["l", "t"]) {
    const up = await admin.storage
      .from("listing-images")
      .upload(`${base}-${variant}.webp`, TINY_WEBP, { contentType: "image/webp" });
    if (up.error) throw up.error;
    files.push(`${base}-${variant}.webp`);
  }
  const img = await admin
    .from("listing_images")
    .insert({ id: imageId, listing_id: listing2.id, storage_path: base, width: 1, height: 1 });
  ok("foto del anuncio registrada", !img.error, img.error?.message);

  r = await admin.rpc("account_storage_objects", { p_user_id: seller.id });
  ok(
    "account_storage_objects lista sus 2 ficheros",
    r.data?.length === 2 && r.data.every((o) => o.bucket_id === "listing-images"),
    JSON.stringify(r.error ?? r.data),
  );
  r = await r1.client.rpc("account_storage_objects", { p_user_id: seller.id });
  ok("…y solo la puede usar el servidor", Boolean(r.error));

  await admin.from("favorites").insert({ user_id: r2.id, listing_id: listing2.id });
  const del = await admin.auth.admin.deleteUser(seller.id);
  ok(
    "se borra la cuenta del vendedor (con anuncios, fotos, chat y denuncias)",
    !del.error,
    del.error?.message,
  );
  if (!del.error) users.splice(users.indexOf(seller.id), 1);

  const [{ data: prof }, { data: lst }, { data: imgs }, { data: favs }] = await Promise.all([
    admin.from("profiles").select("id").eq("id", seller.id).maybeSingle(),
    admin.from("listings").select("id").eq("user_id", seller.id),
    admin.from("listing_images").select("id").eq("id", imageId),
    admin.from("favorites").select("user_id").eq("listing_id", listing2.id),
  ]);
  ok(
    "perfil, anuncios, fotos y favoritos de sus anuncios borrados",
    prof === null && lst?.length === 0 && imgs?.length === 0 && favs?.length === 0,
  );
  const { data: conv } = await admin
    .from("conversations")
    .select("seller_id, buyer_id, listing_id")
    .eq("id", conversationId)
    .single();
  ok(
    "la conversación se conserva para el comprador, anonimizada",
    conv?.seller_id === null && conv?.buyer_id === r1.id && conv?.listing_id === null,
    JSON.stringify(conv),
  );
  const { data: msgs } = await admin
    .from("messages")
    .select("sender_id, body")
    .eq("conversation_id", conversationId)
    .order("id");
  ok(
    "sus mensajes se conservan como «Usuario eliminado»",
    msgs?.length === 2 && msgs[1].sender_id === null && msgs[1].body.includes("Rosa Money"),
    JSON.stringify(msgs),
  );
  const { data: reps } = await admin
    .from("reports")
    .select("listing_id, reported_user_id, reporter_id")
    .or(`conversation_id.eq.${conversationId},reporter_id.eq.${r3.id}`);
  ok(
    "las denuncias se conservan (sin anuncio ni usuario)",
    reps?.length >= 2 && reps.every((x) => x.reported_user_id === null || x.reporter_id === null),
    JSON.stringify(reps),
  );
  r = await r1.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "scam",
  });
  ok(
    "denunciar a una cuenta borrada → recipient_deleted",
    errKey(r) === "recipient_deleted",
    errKey(r),
  );
  r = await admin.rpc("account_storage_objects", { p_user_id: seller.id });
  ok("los ficheros siguen en Storage hasta que el servidor los borre", r.data?.length === 2);
  const rm = await admin.storage.from("listing-images").remove(r.data.map((o) => o.name));
  ok(
    "el servidor los borra con la API de Storage",
    !rm.error && rm.data?.length === 2,
    rm.error?.message,
  );
  files.length = 0;
} catch (error) {
  crash(error);
} finally {
  if (files.length) await admin.storage.from("listing-images").remove(files);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
