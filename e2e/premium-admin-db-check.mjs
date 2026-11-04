// Prueba de extremo a extremo de la fase 1.6 (primera parte) contra el proyecto dev:
// solicitudes y cobros de Premium, acciones del admin, chats denunciados, suspensión y baneo.
// Uso: pnpm e2e premium-admin-db-check   (crea y borra sus propios usuarios)
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
const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
// Cada ejecución, su referencia de pago: las activaciones se quedan aunque se borren los usuarios.
const REF = String(Date.now()).slice(-7);
const users = [];
const chatFiles = [];
const DAY = 86400000;

async function makeUser(label, { isAdmin = false } = {}) {
  const suffix = letters();
  const email = `premium+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `pa_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  if (isAdmin)
    await admin.from("profile_private").update({ role: "admin" }).eq("user_id", data.user.id);
  const client = createClient(url, pub, opts);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, username: `pa_${suffix}`, email, phone, client };
}

try {
  const boss = await makeUser("Admin Prueba", { isAdmin: true });
  const buyer = await makeUser("Compradora Premium");
  const seller = await makeUser("Vendedor Moderado");
  const other = await makeUser("Otra Persona");

  // ─── Solicitud de Premium ───────────────────────────────────────────────────
  let r = await buyer.client.rpc("request_premium", { p_months: 3, p_method: "cash_office" });
  const requestId = r.data;
  ok("solicitar Premium (3 meses, oficina)", Boolean(requestId), errKey(r));
  let { data: req } = await admin.from("premium_requests").select("*").eq("id", requestId).single();
  ok(
    "precio copiado de la configuración: 13.300",
    req.price_xaf === 13300 && req.status === "pending",
    JSON.stringify(req),
  );
  r = await buyer.client.rpc("request_premium", { p_months: 6, p_method: "money_transfer_agency" });
  ({ data: req } = await admin.from("premium_requests").select("*").eq("id", requestId).single());
  ok(
    "cambiar de opinión actualiza la misma solicitud (6 meses, agencia)",
    r.data === requestId &&
      req.months === 6 &&
      req.price_xaf === 23250 &&
      req.payment_method === "money_transfer_agency",
    JSON.stringify(req),
  );
  r = await buyer.client.rpc("request_premium", { p_months: 1, p_method: "bank_transfer" });
  ok(
    "transferencia todavía no (fase 3) → premium_invalid",
    errKey(r) === "premium_invalid",
    errKey(r),
  );
  r = await buyer.client.rpc("request_premium", { p_months: 2, p_method: "cash_office" });
  ok("periodo sin precio → premium_invalid", errKey(r) === "premium_invalid", errKey(r));
  r = await anon.rpc("request_premium", { p_months: 1, p_method: "cash_office" });
  ok("un visitante no puede solicitar", Boolean(r.error));
  r = await buyer.client.from("premium_requests").select("id");
  ok("la usuaria ve su solicitud", r.data?.length === 1);
  r = await other.client.from("premium_requests").select("id");
  ok("otra persona no la ve", r.data?.length === 0);
  r = await buyer.client
    .from("premium_requests")
    .update({ price_xaf: 1 })
    .eq("id", requestId)
    .select("id");
  ok("no se puede cambiar el precio a mano", !r.data?.length);

  await buyer.client.rpc("cancel_premium_request");
  ({ data: req } = await admin
    .from("premium_requests")
    .select("status")
    .eq("id", requestId)
    .single());
  ok("cancelar la solicitud", req.status === "cancelled");
  r = await buyer.client.rpc("request_premium", { p_months: 3, p_method: "cash_office" });
  const requestId2 = r.data;
  ok("después se puede pedir otra", Boolean(requestId2) && requestId2 !== requestId);

  // ─── Activación por el admin ────────────────────────────────────────────────
  const activate = (client, extra) =>
    client.rpc("admin_activate_premium", {
      p_user_id: buyer.id,
      p_months: 3,
      p_amount_xaf: 13300,
      p_method: "cash_office",
      p_reference: ` rec ${REF} `,
      ...extra,
    });
  r = await activate(buyer.client);
  ok("una usuaria normal no puede activar Premium", errKey(r) === "not_admin", errKey(r));
  r = await activate(boss.client);
  const end1 = r.data ? Date.parse(r.data) : 0;
  ok("el admin activa 3 meses", Boolean(r.data), errKey(r));
  ok(
    "…con fecha de fin dentro de unos 3 meses",
    end1 > Date.now() + 88 * DAY && end1 < Date.now() + 93 * DAY,
    r.data,
  );
  const { data: prof } = await admin
    .from("profiles")
    .select("premium_until")
    .eq("id", buyer.id)
    .single();
  ok("premium_until actualizado", Date.parse(prof.premium_until) === end1);
  ({ data: req } = await admin
    .from("premium_requests")
    .select("status, handled_by")
    .eq("id", requestId2)
    .single());
  ok(
    "la solicitud pendiente queda completada por el admin",
    req.status === "completed" && req.handled_by === boss.id,
    JSON.stringify(req),
  );
  const { data: act } = await admin.from("premium_activations").select("*").eq("user_id", buyer.id);
  ok(
    "cobro registrado con la referencia normalizada (REC…)",
    act?.length === 1 &&
      act[0].reference === `REC${REF}` &&
      act[0].request_id === requestId2 &&
      act[0].created_by === boss.id,
    JSON.stringify(act),
  );
  r = await activate(boss.client, { p_reference: `REC${REF}` });
  ok("la misma referencia no se puede repetir", errKey(r) === "premium_reference_used", errKey(r));
  r = await activate(boss.client, { p_reference: "a b" + "#" });
  ok(
    "referencia con caracteres raros → premium_invalid",
    errKey(r) === "premium_invalid",
    errKey(r),
  );
  r = await activate(boss.client, {
    p_months: 1,
    p_amount_xaf: 5000,
    p_method: "money_transfer_agency",
    p_reference: `REC${REF}`,
  });
  const end2 = r.data ? Date.parse(r.data) : 0;
  ok(
    "misma referencia con otro método sí vale (renovar 1 mes por agencia)",
    Boolean(r.data),
    errKey(r),
  );
  ok(
    "renovar estando activo suma al final del periodo actual",
    end2 > end1 + 27 * DAY && end2 < end1 + 32 * DAY,
    `${new Date(end1).toISOString()} → ${r.data}`,
  );
  r = await buyer.client.from("premium_activations").select("id");
  ok("la usuaria ve sus cobros", r.data?.length === 2);
  r = await other.client.from("premium_activations").select("id");
  ok("otra persona no", r.data?.length === 0);
  const { data: log } = await admin
    .from("moderation_log")
    .select("action, admin_id")
    .eq("target_id", buyer.id);
  ok(
    "las activaciones quedan en el registro de moderación",
    log?.filter((l) => l.action === "activate_premium" && l.admin_id === boss.id).length === 2,
  );

  // ─── Lecturas del admin ─────────────────────────────────────────────────────
  r = await boss.client.rpc("admin_metrics");
  ok(
    "métricas para el admin",
    typeof r.data?.premium_active === "number" && typeof r.data?.open_reports === "number",
    JSON.stringify(r.error ?? r.data),
  );
  r = await buyer.client.rpc("admin_metrics");
  ok("…y no para los demás", errKey(r) === "not_admin", errKey(r));
  r = await boss.client.rpc("admin_users", { p_query: buyer.username });
  ok(
    "buscar usuario por nombre de usuario",
    r.data?.length === 1 && r.data[0].email === buyer.email && r.data[0].phone === buyer.phone,
    JSON.stringify(r.error ?? r.data),
  );
  r = await boss.client.rpc("admin_users", { p_query: buyer.email.toUpperCase() });
  ok(
    "…por email",
    r.data?.some((u) => u.id === buyer.id),
  );
  r = await boss.client.rpc("admin_users", { p_query: buyer.phone.slice(-6) });
  ok(
    "…por teléfono",
    r.data?.some((u) => u.id === buyer.id),
  );
  r = await boss.client.rpc("admin_users", { p_user_id: seller.id });
  ok("…o por id", r.data?.length === 1 && r.data[0].username === seller.username);
  r = await other.client.rpc("admin_users", { p_query: "pa_" });
  ok("un usuario normal no puede listar usuarios", errKey(r) === "not_admin", errKey(r));

  // ─── Moderación de anuncios ─────────────────────────────────────────────────
  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const { data: listing } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cat.id,
      city_id: city.id,
      title: "Móvil para moderar",
      description: "Prueba",
      price_xaf: 1000,
      condition: "used",
      attributes: { brand: "Samsung" },
      status: "active",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + DAY).toISOString(),
    })
    .select("id")
    .single();
  for (const reporter of [buyer, other, boss]) {
    await reporter.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  }
  let { data: row } = await admin.from("listings").select("status").eq("id", listing.id).single();
  ok("3 denuncias → en revisión", row.status === "under_review", row.status);
  r = await boss.client.rpc("admin_restore_listing", { p_listing_id: listing.id, p_reason: "  " });
  ok("restaurar sin motivo → reason_required", errKey(r) === "reason_required", errKey(r));
  r = await seller.client.rpc("admin_restore_listing", {
    p_listing_id: listing.id,
    p_reason: "Es legítimo",
  });
  ok("el vendedor no puede restaurarlo", errKey(r) === "not_admin", errKey(r));
  r = await boss.client.rpc("admin_restore_listing", {
    p_listing_id: listing.id,
    p_reason: "Comprobado: es legítimo",
  });
  ({ data: row } = await admin.from("listings").select("status").eq("id", listing.id).single());
  ok("el admin lo restaura", !r.error && row.status === "active", errKey(r));
  const { data: reps } = await admin
    .from("reports")
    .select("status, resolved_by")
    .eq("listing_id", listing.id);
  ok(
    "…y sus denuncias quedan descartadas",
    reps.every((x) => x.status === "dismissed" && x.resolved_by === boss.id),
    JSON.stringify(reps),
  );
  r = await boss.client.rpc("admin_restore_listing", {
    p_listing_id: listing.id,
    p_reason: "otra vez",
  });
  ok(
    "restaurar uno activo → listing_invalid_transition",
    errKey(r) === "listing_invalid_transition",
    errKey(r),
  );
  r = await boss.client.rpc("admin_block_listing", {
    p_listing_id: listing.id,
    p_reason: "Producto prohibido",
  });
  ({ data: row } = await admin
    .from("listings")
    .select("status, moderation_reason")
    .eq("id", listing.id)
    .single());
  ok(
    "el admin bloquea un anuncio con motivo",
    !r.error && row.status === "blocked" && row.moderation_reason === "Producto prohibido",
    errKey(r),
  );
  const { data: ownView } = await seller.client
    .from("listings")
    .select("status, moderation_reason")
    .eq("id", listing.id)
    .single();
  ok("el vendedor ve el motivo", ownView?.moderation_reason === "Producto prohibido");
  r = await seller.client.rpc("reactivate_listing", { p_listing_id: listing.id });
  ok("…y no puede reactivarlo", Boolean(r.error), errKey(r));

  // ─── Chat denunciado ────────────────────────────────────────────────────────
  const { data: listing2 } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cat.id,
      city_id: city.id,
      title: "Otro móvil para el chat",
      description: "Prueba",
      price_xaf: 1000,
      condition: "used",
      attributes: { brand: "Samsung" },
      status: "active",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + DAY).toISOString(),
    })
    .select("id")
    .single();
  const conversations = [];
  for (const who of [buyer, other]) {
    r = await who.client.rpc("start_conversation", { p_listing_id: listing2.id });
    conversations.push(r.data);
    await who.client.rpc("send_message", { p_conversation_id: r.data, p_body: "Hola" });
  }
  const [reported, unreported] = conversations;
  const imagePath = `${reported}/${crypto.randomUUID()}.webp`;
  await admin.storage
    .from("chat-images")
    .upload(imagePath, TINY_WEBP, { contentType: "image/webp" });
  chatFiles.push(imagePath);
  await seller.client.rpc("send_message", {
    p_conversation_id: reported,
    p_body: "Paga por adelantado",
    p_image_path: imagePath,
  });

  r = await boss.client.from("messages").select("id").eq("conversation_id", reported);
  ok("sin denuncia, el admin no lee la conversación", r.data?.length === 0);
  await buyer.client.rpc("report_conversation", {
    p_conversation_id: reported,
    p_reason: "scam",
    p_details: "Pide pago",
  });
  r = await boss.client.from("messages").select("body").eq("conversation_id", reported);
  ok(
    "con denuncia, el admin lee los mensajes",
    r.data?.length === 2,
    JSON.stringify(r.error ?? r.data),
  );
  r = await boss.client.from("conversations").select("id").eq("id", reported);
  ok("…y la conversación", r.data?.length === 1);
  r = await boss.client.storage.from("chat-images").createSignedUrl(imagePath, 60);
  ok("…y sus fotos", Boolean(r.data?.signedUrl), r.error?.message);
  r = await boss.client.from("messages").select("id").eq("conversation_id", unreported);
  ok("pero no las conversaciones sin denuncia", r.data?.length === 0);
  r = await other.client.from("messages").select("id").eq("conversation_id", reported);
  ok("y otra persona tampoco la lee", r.data?.length === 0);

  const { data: chatReport } = await admin
    .from("reports")
    .select("id")
    .eq("conversation_id", reported)
    .single();
  r = await boss.client.rpc("admin_close_report", {
    p_report_id: chatReport.id,
    p_status: "dismissed",
    p_note: "Sin pruebas",
  });
  ok("el admin descarta una denuncia", !r.error, errKey(r));
  r = await boss.client.rpc("admin_close_report", {
    p_report_id: chatReport.id,
    p_status: "resolved",
  });
  ok("cerrarla otra vez → report_not_found", errKey(r) === "report_not_found", errKey(r));

  // ─── Suspensión y baneo ─────────────────────────────────────────────────────
  r = await boss.client.rpc("admin_suspend_user", {
    p_user_id: seller.id,
    p_days: 3,
    p_reason: "Spam",
  });
  const { data: priv } = await admin
    .from("profile_private")
    .select("suspended_until")
    .eq("user_id", seller.id)
    .single();
  ok(
    "suspender 3 días",
    !r.error && Date.parse(priv.suspended_until) > Date.now() + 2.9 * DAY,
    errKey(r),
  );
  r = await seller.client.rpc("send_message", {
    p_conversation_id: unreported,
    p_body: "¿Sigues ahí?",
  });
  ok("suspendido no puede escribir", errKey(r) === "account_restricted", errKey(r));
  r = await boss.client.rpc("admin_suspend_user", {
    p_user_id: seller.id,
    p_days: 0,
    p_reason: "Error",
  });
  r = await seller.client.rpc("send_message", {
    p_conversation_id: unreported,
    p_body: "¿Sigues ahí?",
  });
  ok("quitar la suspensión (0 días)", !r.error, errKey(r));
  r = await boss.client.rpc("admin_suspend_user", { p_user_id: boss.id, p_days: 3, p_reason: "x" });
  ok("un admin no se puede suspender", errKey(r) === "target_is_admin", errKey(r));

  r = await boss.client.rpc("admin_set_banned", {
    p_user_id: seller.id,
    p_banned: true,
    p_reason: "Estafas repetidas",
  });
  ok("banear al vendedor", !r.error, errKey(r));
  const { data: bannedListings } = await admin
    .from("listings")
    .select("status")
    .eq("user_id", seller.id);
  ok(
    "sus anuncios activos quedan bloqueados",
    bannedListings.every((l) => l.status === "blocked"),
    JSON.stringify(bannedListings),
  );
  const { data: hiddenProfile } = await anon
    .from("profiles")
    .select("id")
    .eq("id", seller.id)
    .maybeSingle();
  ok("su perfil deja de ser público", hiddenProfile === null);
  r = await boss.client.rpc("admin_set_banned", {
    p_user_id: seller.id,
    p_banned: false,
    p_reason: "Revisado",
  });
  const { data: back } = await anon.from("profiles").select("id").eq("id", seller.id).maybeSingle();
  ok("quitar el baneo", !r.error && back !== null, errKey(r));
  const actions = (
    await admin.from("moderation_log").select("action").eq("target_id", seller.id)
  ).data.map((l) => l.action);
  ok(
    "todo queda en el registro",
    ["suspend_user", "unsuspend_user", "ban_user", "unban_user"].every((a) => actions.includes(a)),
    actions.join(","),
  );
} catch (error) {
  crash(error);
} finally {
  if (chatFiles.length) await admin.storage.from("chat-images").remove(chatFiles);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
