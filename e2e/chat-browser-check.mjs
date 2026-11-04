// Chat en dos navegadores móviles a la vez (comprador y vendedora) contra un servidor local.
// Uso: pnpm e2e chat-browser-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const TINY_WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAAAAAAAAAAAA",
  "base64",
);

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
let browser;

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
  const email = `chatnav+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `cn_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { data: login } = await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, phone, client, cookies: sessionCookies(login.session) };
}

try {
  const seller = await makeUser("Vendedora Navegador");
  const buyer = await makeUser("Comprador Navegador");
  await admin.from("profile_private").update({ show_whatsapp: true }).eq("user_id", seller.id);

  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const title = `Móvil chat ${letters()}`;
  const { data: listing } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cat.id,
      city_id: city.id,
      title,
      description: "Prueba del chat en el navegador.",
      price_xaf: 90000,
      condition: "used",
      attributes: { brand: "Samsung" },
      status: "active",
      published_at: new Date(Date.now() - 400 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select("id, code")
    .single();
  browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
  });
  const device = {
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    locale: "es-GQ",
  };
  const errors = [];
  const known = (u) => u.includes("/_vercel/insights/");
  const watch = (page, who) => {
    page.on("pageerror", (e) => errors.push(`${who} pageerror: ${e.message}`));
    page.on(
      "console",
      (m) =>
        m.type() === "error" &&
        !m.text().startsWith("Failed to load resource") &&
        errors.push(`${who} console: ${m.text()}`),
    );
    page.on(
      "response",
      (r) => r.status() >= 400 && !known(r.url()) && errors.push(`${who} ${r.status()} ${r.url()}`),
    );
  };

  // ─── Visitante ──────────────────────────────────────────────────────────────
  const visitorContext = await browser.newContext(device);
  const visitor = await visitorContext.newPage();
  watch(visitor, "visitante");
  await visitor.goto(`${BASE}/anuncio/x-${listing.code}`);
  await visitor.waitForURL(/\/anuncio\/.*-malabo-/);
  const realFicha = new URL(visitor.url()).pathname;
  await visitor.waitForSelector("text=Chatear");
  ok("visitante: ve «Chatear»", await visitor.getByRole("link", { name: "Chatear" }).isVisible());
  ok(
    "visitante: no ve WhatsApp",
    (await visitor.getByRole("button", { name: /WhatsApp/ }).count()) === 0,
  );
  ok(
    "la ficha ya no tiene barra inferior",
    (await visitor.getByRole("navigation", { name: "Navegación principal" }).count()) === 0,
  );
  await visitor.getByRole("link", { name: "Chatear" }).click();
  await visitor.waitForURL(/\/entrar/);
  ok(
    "visitante: «Chatear» lleva a entrar y volverá al chat",
    decodeURIComponent(visitor.url()).includes(`next=/mensajes/anuncio/${listing.code}`),
  );
  await visitorContext.close();

  // ─── Comprador abre el chat ─────────────────────────────────────────────────
  const buyerContext = await browser.newContext(device);
  await buyerContext.addCookies(buyer.cookies);
  const buyerPage = await buyerContext.newPage();
  watch(buyerPage, "comprador");
  await buyerPage.goto(`${BASE}${realFicha}`);
  await buyerPage.waitForSelector("text=WhatsApp");
  ok(
    "comprador con sesión: ve WhatsApp y Chatear",
    await buyerPage
      .getByRole("button", { name: /WhatsApp/ })
      .filter({ visible: true })
      .first()
      .isVisible(),
  );

  // WhatsApp: se intercepta wa.me para ver a dónde iría.
  let waUrl = null;
  await buyerContext.route("https://wa.me/**", (route) => {
    waUrl = route.request().url();
    route.fulfill({ status: 200, body: "wa" });
  });
  await buyerPage
    .getByRole("button", { name: /WhatsApp/ })
    .filter({ visible: true })
    .first()
    .click();
  await buyerPage.waitForURL(/wa\.me/, { timeout: 15000 }).catch(() => {});
  ok(
    "WhatsApp abre wa.me con el teléfono y el anuncio",
    Boolean(waUrl) &&
      waUrl.includes(seller.phone.slice(1)) &&
      decodeURIComponent(waUrl).includes(title),
    waUrl ?? "sin navegación",
  );

  await buyerPage.goto(`${BASE}${realFicha}`);
  await buyerPage.getByRole("link", { name: "Chatear" }).filter({ visible: true }).first().click();
  await buyerPage.waitForURL(new RegExp(`/mensajes/anuncio/${listing.code}`));
  await buyerPage
    .getByRole("button", { name: "Hola, ¿sigue disponible?" })
    .filter({ visible: true })
    .first()
    .click();
  await buyerPage.waitForURL(/\/mensajes\/[0-9a-f-]{36}/);
  const conversationUrl = buyerPage.url();
  await buyerPage.waitForSelector("text=Hola, ¿sigue disponible?");
  ok("respuesta rápida: crea la conversación y envía", true);
  ok(
    "aviso de seguridad en la conversación",
    await buyerPage.getByText("Por tu seguridad").filter({ visible: true }).first().isVisible(),
  );

  // ─── Vendedora: bandeja y no leídos ─────────────────────────────────────────
  const sellerContext = await browser.newContext(device);
  await sellerContext.addCookies(seller.cookies);
  const sellerPage = await sellerContext.newPage();
  watch(sellerPage, "vendedora");
  await sellerPage.goto(`${BASE}/mensajes`);
  await sellerPage.waitForSelector(`text=Tu anuncio · ${title}`);
  ok("bandeja de la vendedora con la conversación", true);
  ok(
    "contador de no leídos en la conversación",
    await sellerPage
      .getByRole("img", { name: "1 mensaje sin leer" })
      .filter({ visible: true })
      .first()
      .isVisible(),
  );
  await sellerPage
    .waitForSelector('a[aria-label="Mensajes, 1 sin leer"]', { timeout: 10000 })
    .catch(() => {});
  ok(
    "contador en la barra inferior",
    (await sellerPage.locator('a[aria-label="Mensajes, 1 sin leer"]').count()) === 1,
  );

  // Mensaje nuevo con la bandeja abierta: se actualiza sola.
  await buyerPage
    .getByRole("textbox", { name: "Escribe un mensaje" })
    .filter({ visible: true })
    .first()
    .fill("¿Lo puedo ver esta tarde?");
  await buyerPage
    .getByRole("button", { name: "Enviar", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await sellerPage
    .waitForSelector("text=¿Lo puedo ver esta tarde?", { timeout: 15000 })
    .catch(() => {});
  ok(
    "la bandeja se actualiza sola al llegar un mensaje",
    await sellerPage
      .getByText("¿Lo puedo ver esta tarde?")
      .filter({ visible: true })
      .first()
      .isVisible(),
  );

  // ─── Conversación en directo ────────────────────────────────────────────────
  await sellerPage.getByText("¿Lo puedo ver esta tarde?").filter({ visible: true }).first().click();
  await sellerPage.waitForURL(/\/mensajes\/[0-9a-f-]{36}/);
  ok("la vendedora entra en la misma conversación", sellerPage.url() === conversationUrl);
  await buyerPage.waitForSelector("text=Visto", { timeout: 15000 }).catch(() => {});
  ok(
    "el comprador ve «Visto» en directo",
    await buyerPage.getByText("Visto").filter({ visible: true }).first().isVisible(),
  );

  await sellerPage
    .getByRole("textbox", { name: "Escribe un mensaje" })
    .filter({ visible: true })
    .first()
    .fill("Sí, a las 17:00 en Ela Nguema.");
  await sellerPage
    .getByRole("button", { name: "Enviar", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await buyerPage
    .waitForSelector("text=Sí, a las 17:00 en Ela Nguema.", { timeout: 15000 })
    .catch(() => {});
  ok(
    "el comprador recibe la respuesta sin recargar",
    await buyerPage
      .getByText("Sí, a las 17:00 en Ela Nguema.")
      .filter({ visible: true })
      .first()
      .isVisible(),
  );

  // Foto
  await buyerPage
    .locator('input[type="file"]')
    .filter({ visible: true })
    .first()
    .setInputFiles({ name: "foto.webp", mimeType: "image/webp", buffer: TINY_WEBP });
  await sellerPage
    .waitForSelector('img[alt="Foto de la conversación"]', { timeout: 20000 })
    .catch(() => {});
  ok(
    "una foto llega a la otra persona en directo",
    (await sellerPage.locator('img[alt="Foto de la conversación"]').count()) === 1,
  );
  const src = await sellerPage
    .locator('img[alt="Foto de la conversación"]')
    .first()
    .getAttribute("src")
    .catch(() => null);
  ok("…servida con URL firmada", Boolean(src?.includes("/object/sign/chat-images/")), src ?? "");

  // Borrador guardado
  await buyerPage
    .getByRole("textbox", { name: "Escribe un mensaje" })
    .filter({ visible: true })
    .first()
    .fill("Borrador sin enviar");
  await buyerPage.reload();
  await buyerPage.waitForSelector("text=Sí, a las 17:00 en Ela Nguema.");
  ok(
    "el borrador sobrevive a una recarga",
    (await buyerPage.getByRole("textbox", { name: "Escribe un mensaje" }).inputValue()) ===
      "Borrador sin enviar",
  );

  // ─── Bloqueo ────────────────────────────────────────────────────────────────
  await sellerPage.getByLabel("Más opciones").filter({ visible: true }).first().click();
  await sellerPage
    .getByRole("button", { name: /^Bloquear a/ })
    .filter({ visible: true })
    .first()
    .click();
  await sellerPage.waitForSelector("text=Has bloqueado a esta persona");
  ok("la vendedora bloquea desde el menú", true);
  await buyerPage
    .getByRole("button", { name: "Enviar", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await buyerPage
    .waitForSelector("text=hay un bloqueo entre vosotros", { timeout: 15000 })
    .catch(() => {});
  ok(
    "el comprador bloqueado no puede enviar y lo ve",
    await buyerPage
      .getByText("hay un bloqueo entre vosotros")
      .filter({ visible: true })
      .first()
      .isVisible(),
  );
  await sellerPage.getByLabel("Más opciones").filter({ visible: true }).first().click();
  await sellerPage
    .getByRole("button", { name: /^Desbloquear a/ })
    .filter({ visible: true })
    .first()
    .click();
  await sellerPage
    .getByRole("textbox", { name: "Escribe un mensaje" })
    .filter({ visible: true })
    .first()
    .waitFor();
  await buyerPage
    .getByRole("button", { name: "Reintentar" })
    .filter({ visible: true })
    .first()
    .click();
  await sellerPage.waitForSelector("text=Borrador sin enviar", { timeout: 15000 }).catch(() => {});
  ok(
    "tras desbloquear, «Reintentar» lo envía",
    await sellerPage.getByText("Borrador sin enviar").filter({ visible: true }).first().isVisible(),
  );

  // ─── Dueña en su ficha ──────────────────────────────────────────────────────
  await sellerPage.goto(`${BASE}${realFicha}`);
  await sellerPage.waitForSelector("text=Editar mi anuncio");
  ok(
    "en su propia ficha la vendedora ve «Editar mi anuncio»",
    (await sellerPage.getByRole("link", { name: "Chatear" }).count()) === 0,
  );

  ok(
    "sin errores de JavaScript ni peticiones fallidas",
    errors.length === 0,
    errors.slice(0, 5).join(" | "),
  );
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
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
