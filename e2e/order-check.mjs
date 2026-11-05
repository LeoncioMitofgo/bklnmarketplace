// Anuncios por encargo (D-079): la marca y el plazo en el asistente, la tarjeta, la ficha y el chat,
// con sus avisos de seguridad. Contra un servidor local (pnpm start -p 3100).
// Uso: pnpm e2e order-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
let browser;

const ORDER_TIPS = "es normal que te pidan un anticipo";
const NORMAL_TIP = "No pagues nada por adelantado.";
const CHAT_ORDER = "es un encargo, así que es normal un anticipo";
const CHAT_NORMAL = "no pagues nada por adelantado, queda en un lugar público";

function sessionCookies(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const CHUNK = 3180;
  const base = { domain: "localhost", path: "/", httpOnly: false, sameSite: "Lax" };
  if (value.length <= CHUNK) return [{ ...base, name, value }];
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++)
    parts.push({ ...base, name: `${name}.${i}`, value: value.slice(i * CHUNK, (i + 1) * CHUNK) });
  return parts;
}

async function makeUser(label) {
  const suffix = letters();
  const email = `encargo+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `enc_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { data: login } = await client.auth.signInWithPassword({ email, password });
  const cookies = sessionCookies(login.session);
  return {
    id: data.user.id,
    username: `enc_${suffix}`,
    client,
    cookies,
    header: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}

const get = async (path, cookie) => {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
  return { status: res.status, body: await res.text() };
};

try {
  const seller = await makeUser("Vendedora Encargos");
  const buyer = await makeUser("Comprador Encargos");
  const tag = letters();

  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const listing = (title, extra) =>
    admin
      .from("listings")
      .insert({
        user_id: seller.id,
        category_id: cat.id,
        city_id: city.id,
        title,
        description: "Prueba de los anuncios por encargo.",
        price_xaf: 250000,
        condition: "new",
        attributes: { brand: "Samsung" },
        status: "active",
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        ...extra,
      })
      .select("id, code")
      .single()
      .then((r) => {
        if (r.error) throw r.error;
        return r.data;
      });
  const order = await listing(`Galaxy encargo ${tag}`, { order_lead_time: "weeks_2_4" });
  const normal = await listing(`Galaxy en mano ${tag}`, {});

  // ─── Páginas públicas ──────────────────────────────────────────────────────

  const orderPage = await get(`/anuncio/${order.code}`);
  ok("ficha del encargo", orderPage.status === 200, String(orderPage.status));
  ok("…con «Por encargo · 2–4 semanas»", orderPage.body.includes("Por encargo · 2–4 semanas"));
  ok(
    "…y los consejos de los encargos, no los de siempre",
    orderPage.body.includes(ORDER_TIPS) && !orderPage.body.includes(NORMAL_TIP),
  );
  ok("…y BackOrder en los datos estructurados", orderPage.body.includes("schema.org/BackOrder"));

  const normalPage = await get(`/anuncio/${normal.code}`);
  ok(
    "la ficha de lo que ya tiene: sin marca y con los consejos de siempre",
    normalPage.status === 200 &&
      !normalPage.body.includes("Por encargo ·") &&
      normalPage.body.includes(NORMAL_TIP) &&
      normalPage.body.includes("schema.org/InStock"),
  );

  const search = await get(`/buscar?q=${tag}`);
  ok(
    "en la búsqueda, el encargo lleva la insignia",
    search.body.includes(`Galaxy encargo ${tag}`) && search.body.includes("POR ENCARGO"),
  );
  const profile = await get(`/u/${seller.username}`);
  ok(
    "en el perfil, una sola insignia (la del encargo)",
    profile.body.split("POR ENCARGO").length - 1 === 1,
    String(profile.body.split("POR ENCARGO").length - 1),
  );

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const newChat = await get(`/mensajes/anuncio/${order.code}`, buyer.header);
  ok("chat nuevo de un encargo: su aviso", newChat.body.includes(CHAT_ORDER));
  const newNormalChat = await get(`/mensajes/anuncio/${normal.code}`, buyer.header);
  ok(
    "chat nuevo de lo que ya tiene: el aviso de siempre",
    newNormalChat.body.includes(CHAT_NORMAL) && !newNormalChat.body.includes(CHAT_ORDER),
  );

  const { data: conversationId } = await buyer.client.rpc("start_conversation", {
    p_listing_id: order.id,
  });
  await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Hola, ¿cuánto de anticipo?",
  });
  const chat = await get(`/mensajes/${conversationId}`, buyer.header);
  ok("conversación de un encargo: su aviso", chat.body.includes(CHAT_ORDER));
  const sellerChat = await get(`/mensajes/${conversationId}`, seller.header);
  ok("…también para la vendedora", sellerChat.body.includes(CHAT_ORDER));

  // ─── Asistente: marcar y desmarcar ─────────────────────────────────────────

  browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const context = await browser.newContext({
    viewport: { width: 360, height: 760 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addCookies(seller.cookies);
  const page = await context.newPage();

  await page.goto(`${BASE}/publicar/${normal.id}`);
  await page.getByRole("button", { name: "Detalles ›" }).click();
  const leadTime = page.getByLabel("Plazo de entrega aproximado");
  await page.getByText("¿Lo tienes ya?").waitFor();
  ok(
    "detalles: «Lo tengo ya» marcado y sin plazo a la vista",
    (await page.locator("#availability-stock").isChecked()) && !(await leadTime.isVisible()),
  );

  await page.locator("label:has(#availability-order)").click();
  ok("al elegir «Por encargo» aparece el plazo", await leadTime.isVisible());
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByText("Elige en cuánto tiempo lo entregas.").waitFor();
  ok("sin plazo no se guarda", true);

  await leadTime.selectOption("weeks_1_2");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByText("Revisa tu anuncio").waitFor();
  const review = await page.locator("main").innerText();
  ok(
    "la revisión enseña el plazo y el aviso para quien vende por encargo",
    review.includes("Por encargo · 1–2 semanas") && review.includes("pide como mucho un anticipo"),
  );
  let { data: saved } = await admin
    .from("listings")
    .select("order_lead_time, status")
    .eq("id", normal.id)
    .single();
  ok(
    "guardado como encargo y sigue activo",
    saved.order_lead_time === "weeks_1_2" && saved.status === "active",
    JSON.stringify(saved),
  );
  const nowOrder = await get(`/anuncio/${normal.code}`);
  ok("la ficha ya lo enseña", nowOrder.body.includes("Por encargo · 1–2 semanas"));

  await page.getByRole("button", { name: "Detalles ›" }).click();
  await page.getByText("¿Lo tienes ya?").waitFor();
  ok(
    "al volver, «Por encargo» sigue marcado",
    await page.locator("#availability-order").isChecked(),
  );
  await page.locator("label:has(#availability-stock)").click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByText("Revisa tu anuncio").waitFor();
  ({ data: saved } = await admin
    .from("listings")
    .select("order_lead_time")
    .eq("id", normal.id)
    .single());
  ok("con «Lo tengo ya» se quita el plazo", saved.order_lead_time === null, JSON.stringify(saved));

  // La base de datos solo acepta los plazos del enum.
  const bad = await seller.client
    .from("listings")
    .update({ order_lead_time: "manana" })
    .eq("id", normal.id);
  ok(
    "un plazo inventado lo rechaza la base de datos",
    bad.error?.code === "22P02",
    bad.error?.code,
  );
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  // La conversación no se borra con las cuentas (se queda como "Usuario eliminado"): fuera antes.
  for (const id of users) {
    await admin.from("conversations").delete().or(`buyer_id.eq.${id},seller_id.eq.${id}`);
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
