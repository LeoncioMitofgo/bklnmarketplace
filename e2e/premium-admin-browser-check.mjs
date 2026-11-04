// Fase 1.6 (primera parte) en un navegador móvil real (Chromium, 360 px) contra el servidor local:
// Hazte Premium (visitante → entrar → solicitud → WhatsApp), panel de admin (pagos, denuncias,
// chat denunciado, suspender y banear) y que el panel no exista para quien no es admin.
// Uso: pnpm e2e premium-admin-browser-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const DAY = 86400000;

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
let browser;

async function makeUser(label, { isAdmin = false } = {}) {
  const suffix = letters();
  const email = `pnav+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `pn_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  if (isAdmin)
    await admin.from("profile_private").update({ role: "admin" }).eq("user_id", data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, username: `pn_${suffix}`, password, client, label };
}

async function login(page, user) {
  await page.getByLabel("Usuario, email o teléfono").fill(user.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
const text = async (page) =>
  (await page.locator("main").filter({ visible: true }).first().innerText()).replace(/\s+/g, " ");
const waitText = (page, value, timeout = 15000) =>
  page.getByText(value).filter({ visible: true }).first().waitFor({ timeout });

try {
  const buyer = await makeUser("Compradora Premium");
  const seller = await makeUser("Vendedor Revisado");
  const boss = await makeUser("Jefa Admin", { isAdmin: true });
  const reporters = [await makeUser("Denunciante A"), await makeUser("Denunciante B")];

  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const newListing = async (title) =>
    (
      await admin
        .from("listings")
        .insert({
          user_id: seller.id,
          category_id: cat.id,
          city_id: city.id,
          title,
          description: "Prueba del panel.",
          price_xaf: 80000,
          condition: "used",
          attributes: { brand: "Samsung" },
          status: "active",
          published_at: new Date(Date.now() - 400 * DAY).toISOString(),
          expires_at: new Date(Date.now() + DAY).toISOString(),
        })
        .select("id")
        .single()
    ).data;
  const tag = letters();
  const listing = await newListing(`Móvil revisado ${tag}`);
  const listing2 = await newListing(`Móvil chat ${tag}`);
  for (const reporter of [...reporters, buyer]) {
    await reporter.client.rpc("report_listing", { p_listing_id: listing.id, p_reason: "scam" });
  }
  const r = await buyer.client.rpc("start_conversation", { p_listing_id: listing2.id });
  const conversationId = r.data;
  await buyer.client.rpc("send_message", { p_conversation_id: conversationId, p_body: "Hola" });
  await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: `Paga ${tag} por adelantado`,
  });
  await buyer.client.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: "scam",
    p_details: "Pide pago antes",
  });

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
  const watch = (page, who, allow404 = () => false) => {
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
      (res) =>
        res.status() >= 400 &&
        !res.url().includes("/_vercel/insights/") &&
        !(res.status() === 404 && allow404(res.url())) &&
        errors.push(`${who} ${res.status()} ${res.url()}`),
    );
  };

  // ─── Hazte Premium ──────────────────────────────────────────────────────────
  const buyerContext = await browser.newContext(device);
  const page = await buyerContext.newPage();
  watch(page, "compradora", (u) => u.includes("/admin"));
  await page.goto(`${BASE}/premium`);
  // Los precios llegan en streaming, después de la comparativa.
  await waitText(page, "Ahorras 27.000 FCFA");
  const premiumText = await text(page);
  ok(
    "comparativa con los límites de la configuración (10 / 200)",
    /Anuncios activos a la vez\s*10\s*200/.test(premiumText),
    premiumText.slice(0, 300),
  );
  ok(
    "los 4 periodos con su precio",
    [
      "1 mes · 5.000 FCFA",
      "3 meses · 13.300 FCFA",
      "6 meses · 23.250 FCFA",
      "12 meses · 33.000 FCFA",
    ].every((p) => premiumText.includes(p)),
  );
  ok("ahorro y precio por mes", premiumText.includes("4.433 FCFA al mes · Ahorras 1.700 FCFA"));
  ok("«Mejor precio» en 12 meses", premiumText.includes("12 meses · 33.000 FCFA Mejor precio"));
  ok(
    "formas de pago con la oficina y el WhatsApp",
    premiumText.includes("Banapa") && premiumText.includes("+240 555 220 846"),
  );
  ok(
    "sin scroll horizontal a 360 px",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await page.getByRole("link", { name: "Entra para hacerte Premium" }).click();
  await page.waitForURL(/\/entrar/);
  await login(page, buyer);
  await page.waitForURL((u) => u.pathname === "/premium");
  await page.getByRole("button", { name: "Solicitar Premium" }).waitFor();
  ok("tras entrar, vuelve a Hazte Premium con el formulario", true);

  await page.getByLabel(/^3 meses/).check();
  await page.getByLabel(/Por agencia de envío/).check();
  await page.getByRole("button", { name: "Solicitar Premium" }).click();
  await waitText(page, "Tu solicitud está pendiente de pago");
  ok(
    "solicitud pendiente: 3 meses por agencia",
    (await text(page)).includes("3 meses · 13.300 FCFA · Por agencia de envío de dinero"),
  );
  const wa = await page
    .locator('a[href^="https://wa.me/240555220846"]')
    .first()
    .getAttribute("href");
  const waText = decodeURIComponent(wa ?? "");
  ok(
    "botón de WhatsApp con usuario, importe y periodo",
    waText.includes(`@${buyer.username}`) &&
      waText.includes("13.300 FCFA") &&
      waText.includes("3 meses") &&
      waText.includes("Código del envío"),
    waText,
  );
  let { data: req } = await admin
    .from("premium_requests")
    .select("months, payment_method, price_xaf")
    .eq("user_id", buyer.id)
    .eq("status", "pending")
    .single();
  ok(
    "guardada en la base de datos",
    req?.months === 3 && req.payment_method === "money_transfer_agency" && req.price_xaf === 13300,
    JSON.stringify(req),
  );

  await page.getByLabel(/^6 meses/).check();
  await page.getByLabel(/En la oficina/).check();
  await page.getByRole("button", { name: "Cambiar la solicitud" }).click();
  // "6 meses · 23.250 FCFA" ya está en las opciones: se espera a las instrucciones de la oficina.
  ok(
    "cambiar la solicitud: 6 meses en la oficina",
    await waitText(page, `di tu nombre de usuario: @${buyer.username}`).then(
      () => true,
      () => false,
    ),
  );
  ({ data: req } = await admin
    .from("premium_requests")
    .select("months, payment_method")
    .eq("user_id", buyer.id)
    .eq("status", "pending")
    .single());
  ok("…actualizada", req?.months === 6 && req.payment_method === "cash_office");

  await page.goto(`${BASE}/admin`);
  await waitText(page, "Esta página no existe");
  ok("el panel no existe para quien no es admin", true);

  // ─── Panel: pagos ───────────────────────────────────────────────────────────
  const bossContext = await browser.newContext(device);
  const ap = await bossContext.newPage();
  watch(ap, "admin");
  await ap.goto(`${BASE}/entrar?next=/cuenta`);
  await login(ap, boss);
  await ap.waitForURL(/\/cuenta$/);
  await ap.getByRole("link", { name: "Panel de administración" }).filter({ visible: true }).click();
  await ap.waitForURL(/\/admin$/);
  await waitText(ap, "Pagos por confirmar");
  ok("Mi cuenta → Panel de administración", true);
  await waitText(ap, "Validación del mercado");
  const home = await text(ap);
  ok(
    "métricas de validación: mensajes, respuesta, activos y Premium (D-072)",
    ["Anuncios con mensajes", "Tiempo de respuesta", "Usuarios activos (7 días)"].every((s) =>
      home.includes(s),
    ) && /\d+ solicitud(es)?/.test(home),
    home.slice(-400),
  );
  ok(
    "enlace a las visitas en Vercel Analytics",
    (await ap.getByRole("link", { name: /Vercel Analytics/ }).getAttribute("href"))?.includes(
      "vercel.com/bkln-software/bkln_marketplace/analytics",
    ),
  );
  ok(
    "sin scroll horizontal en el panel",
    await ap.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await ap.getByRole("link", { name: "Pagos", exact: true }).click();
  await ap.waitForURL(/\/admin\/pagos$/);
  const card = ap.getByRole("link").filter({ hasText: `@${buyer.username}` });
  await card.first().waitFor();
  ok(
    "la solicitud aparece en Pagos",
    (await card.first().innerText()).includes("6 meses · 23.250 FCFA"),
  );
  await card.first().click();
  await ap.waitForURL(new RegExp(`/admin/usuarios/${buyer.id}`));
  await ap.getByLabel("Número de recibo o código del envío").waitFor();
  ok(
    "la ficha muestra la solicitud pendiente",
    (await text(ap)).includes("Solicitud pendiente: 6 meses · 23.250 FCFA"),
  );
  ok(
    "el formulario viene relleno (6 meses, 23250, oficina)",
    (await ap.getByLabel("Periodo").inputValue()) === "6" &&
      (await ap.getByLabel("Importe cobrado (FCFA)").inputValue()) === "23250" &&
      (await ap.getByLabel("Forma de pago").inputValue()) === "cash_office",
  );
  await ap.getByLabel("Periodo").selectOption("3");
  ok(
    "al cambiar el periodo cambia el importe",
    (await ap.getByLabel("Importe cobrado (FCFA)").inputValue()) === "13300",
  );
  await ap.getByLabel("Periodo").selectOption("6");
  ok("se ve la fecha de fin calculada", (await text(ap)).includes("Premium hasta el "));
  const reference = `rec ${tag}`;
  await ap.getByLabel("Número de recibo o código del envío").fill(reference);
  await ap.getByRole("button", { name: "Registrar el pago y activar Premium" }).click();
  await waitText(ap, "Hecho: Premium hasta el");
  ok("pago registrado y Premium activado", true);
  const { data: prof } = await admin
    .from("profiles")
    .select("premium_until")
    .eq("id", buyer.id)
    .single();
  const until = Date.parse(prof.premium_until);
  ok(
    "premium_until a unos 6 meses",
    until > Date.now() + 178 * DAY && until < Date.now() + 186 * DAY,
    prof.premium_until,
  );
  const { data: act } = await admin
    .from("premium_activations")
    .select("reference, amount_xaf, created_by")
    .eq("user_id", buyer.id)
    .single();
  ok(
    "cobro con la referencia normalizada y quién lo registró",
    act?.reference === `REC${tag.toUpperCase()}` &&
      act.amount_xaf === 23250 &&
      act.created_by === boss.id,
    JSON.stringify(act),
  );
  await ap.getByLabel("Número de recibo o código del envío").fill(reference);
  await ap.getByRole("button", { name: "Registrar el pago y ampliar Premium" }).click();
  await waitText(ap, "Esa referencia ya se usó");
  ok("la misma referencia otra vez → error", true);

  await page.goto(`${BASE}/premium`);
  await waitText(page, "Eres Premium hasta el");
  ok("la usuaria ve que ya es Premium", !(await text(page)).includes("pendiente de pago"));
  await page.goto(`${BASE}/cuenta`);
  await waitText(page, "Premium hasta el");
  ok(
    "…y en Mi cuenta, con «Renovar»",
    await page.getByRole("link", { name: "Renovar" }).filter({ visible: true }).first().isVisible(),
  );

  // ─── Panel: denuncias ───────────────────────────────────────────────────────
  await ap.getByRole("link", { name: "Denuncias", exact: true }).click();
  await ap.waitForURL(/\/admin\/denuncias$/);
  const group = ap.getByRole("link").filter({ hasText: `Móvil revisado ${tag}` });
  await group.first().waitFor();
  ok(
    "el anuncio oculto aparece con sus 3 denuncias",
    /En revisión\s*3 denuncias/.test(await group.first().innerText()),
    await group.first().innerText(),
  );
  await group.first().click();
  await ap.waitForURL(/\/admin\/denuncias\/anuncio\//);
  await ap.getByRole("button", { name: "Restaurar" }).waitFor();
  await ap.locator("#moderation-reason").fill("Revisado: es legítimo");
  await ap.getByRole("button", { name: "Restaurar" }).click();
  await waitText(ap, "Anuncio restaurado.");
  let { data: row } = await admin.from("listings").select("status").eq("id", listing.id).single();
  ok("restaurar → activo", row.status === "active", row.status);
  await ap.locator("#moderation-reason").fill("Producto prohibido");
  await ap.getByRole("button", { name: "Bloquear" }).click();
  await waitText(ap, "Anuncio bloqueado.");
  ({ data: row } = await admin
    .from("listings")
    .select("status, moderation_reason")
    .eq("id", listing.id)
    .single());
  ok(
    "bloquear → bloqueado con motivo",
    row.status === "blocked" && row.moderation_reason === "Producto prohibido",
    JSON.stringify(row),
  );

  await ap.goto(`${BASE}/admin/denuncias`);
  const person = ap.getByRole("link").filter({ hasText: `@${seller.username}` });
  await person.first().waitFor();
  await person.first().click();
  await ap.waitForURL(/\/admin\/denuncias\/[0-9a-f-]{36}$/);
  await waitText(ap, `Paga ${tag} por adelantado`);
  ok(
    "la denuncia del chat deja leer la conversación",
    (await text(ap)).includes("Pide pago antes"),
  );
  await ap.getByRole("button", { name: "Descartar" }).click();
  await waitText(ap, "Denuncia descartada.");
  ok("descartar la denuncia del chat", true);

  // ─── Panel: suspender y banear ──────────────────────────────────────────────
  await ap.goto(`${BASE}/admin/usuarios?q=${seller.username}`);
  await ap
    .getByRole("link")
    .filter({ hasText: `@${seller.username}` })
    .first()
    .click();
  await ap.waitForURL(new RegExp(`/admin/usuarios/${seller.id}`));
  await ap.locator("#suspend-reason").waitFor();
  ok("buscar al vendedor y abrir su ficha", true);
  await ap.locator("#suspend-reason").fill("Spam en el chat");
  await ap.getByRole("button", { name: "Suspender" }).click();
  await waitText(ap, "Suspendido 3 días.");
  await waitText(ap, "Suspendido hasta");
  ok("suspender 3 días (y se ve la etiqueta)", true);
  await ap.locator("#ban-reason").fill("Estafas repetidas");
  await ap.getByRole("button", { name: "Banear" }).click();
  await waitText(ap, "Usuario baneado");
  const { data: bannedProfile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", seller.id)
    .single();
  const { data: authUser } = await admin.auth.admin.getUserById(seller.id);
  ok(
    "baneado en la base de datos y sin acceso en Auth",
    bannedProfile.status === "banned" &&
      Date.parse(authUser.user?.banned_until ?? "") > Date.now() + 300 * DAY,
    `${bannedProfile.status} ${authUser.user?.banned_until}`,
  );
  await ap.locator("#unban-reason").fill("Revisado con el usuario");
  await ap.getByRole("button", { name: "Quitar el baneo" }).click();
  await waitText(ap, "Baneo quitado.");
  const { data: authAfter } = await admin.auth.admin.getUserById(seller.id);
  ok(
    "quitar el baneo devuelve el acceso",
    !authAfter.user?.banned_until || Date.parse(authAfter.user.banned_until) < Date.now(),
    authAfter.user?.banned_until,
  );
  const history = await text(ap);
  ok(
    "el historial lo recoge",
    ["Suspendido", "Baneado", "Baneo quitado"].every((v) => history.includes(v)),
    history.slice(-300),
  );

  // En un portátil (D-071): menú a la izquierda, usuarios en tabla y la ficha a dos columnas.
  await ap.setViewportSize({ width: 1366, height: 860 });
  await ap.goto(`${BASE}/admin/usuarios`);
  await waitText(ap, "Los últimos en registrarse");
  const nav = await ap.locator("aside nav").boundingBox();
  ok(
    "portátil: menú del panel a la izquierda",
    nav && nav.x < 40 && nav.height > nav.width,
    JSON.stringify(nav),
  );
  ok(
    "portátil: los usuarios en tabla, con el teléfono en su columna",
    await ap.getByText("Teléfono", { exact: true }).filter({ visible: true }).first().isVisible(),
  );
  await ap.goto(`${BASE}/admin/usuarios/${seller.id}`);
  // Llega en streaming: medir cuando ya se ve, no cuando está en el HTML todavía oculto.
  await ap.locator("#premium").waitFor({ state: "visible" });
  const premium = await ap.locator("#premium").boundingBox();
  const moderation = await ap.getByRole("heading", { name: "Moderación" }).boundingBox();
  ok(
    "portátil: la ficha del usuario a dos columnas",
    premium && moderation && moderation.x > premium.x + premium.width,
    JSON.stringify({ premium, moderation }),
  );
  await ap.setViewportSize({ width: 360, height: 740 });

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
