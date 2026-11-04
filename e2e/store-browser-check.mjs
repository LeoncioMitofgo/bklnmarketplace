// Tienda Premium /t/<slug> (1.6, segunda parte) en un navegador móvil (Chromium, 360 px).
// Uso: pnpm e2e store-browser-check
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

async function makeUser(label, { premium = false } = {}) {
  const suffix = letters();
  const email = `tienda+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `ti_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  if (premium)
    await admin
      .from("profiles")
      .update({ premium_until: new Date(Date.now() + 30 * DAY).toISOString() })
      .eq("id", data.user.id);
  return { id: data.user.id, username: `ti_${suffix}`, password, label };
}
const mediaFiles = async (userId) =>
  ((await admin.storage.from("profile-media").list(userId)).data ?? []).map((f) => f.name);

try {
  const tag = letters();
  const seller = await makeUser(`Vendedor ${tag}`, { premium: true });
  const rival = await makeUser("Tienda Rival", { premium: true });
  const normal = await makeUser("Usuario Normal");
  const buyer = await makeUser("Compradora");
  await admin.from("stores").insert({ user_id: rival.id, slug: `ocupada-${tag}`, name: "Rival" });
  await admin.from("profile_private").update({ show_whatsapp: true }).eq("user_id", seller.id);

  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const base = {
    user_id: seller.id,
    category_id: cat.id,
    city_id: city.id,
    description: "Prueba de tienda",
    price_xaf: 50000,
    condition: "used",
    attributes: { brand: "Samsung" },
    published_at: new Date(Date.now() - 400 * DAY).toISOString(),
    expires_at: new Date(Date.now() + DAY).toISOString(),
  };
  const { data: listings } = await admin
    .from("listings")
    .insert([
      { ...base, title: `Móvil uno ${tag}`, status: "active" },
      { ...base, title: `Móvil dos ${tag}`, status: "active" },
      { ...base, title: `Móvil vendido ${tag}`, status: "sold", sold_at: new Date().toISOString() },
    ])
    .select("id, code, title");
  const { data: demo } = await admin
    .from("listing_images")
    .select("storage_path, format")
    .limit(1)
    .single();
  const photo = Buffer.from(
    await (
      await fetch(
        `${url}/storage/v1/object/public/listing-images/${demo.storage_path}-l.${demo.format}`,
      )
    ).arrayBuffer(),
  );

  browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
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
      (r) =>
        r.status() >= 400 &&
        !r.url().includes("/_vercel/insights/") &&
        !(r.status() === 404 && allow404(r.url())) &&
        errors.push(`${who} ${r.status()} ${r.url()}`),
    );
  };
  const login = async (page, user, next) => {
    await page.goto(`${BASE}/entrar?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Usuario, email o teléfono").fill(user.username);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === next);
  };
  const visible = (page, text) => page.getByText(text).filter({ visible: true }).first();
  const submit = async (page, name) => {
    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().startsWith(BASE),
      ),
      page.getByRole("button", { name }).click(),
    ]);
    await page.waitForTimeout(300);
  };

  // ─── Sin Premium ────────────────────────────────────────────────────────────
  const np = await (await browser.newContext(device)).newPage();
  watch(np, "normal");
  await login(np, normal, "/cuenta/tienda");
  await visible(np, "La tienda es para vendedores Premium").waitFor();
  ok(
    "sin Premium: explica la tienda y lleva a Hazte Premium",
    (await np.getByRole("link", { name: "Hazte Premium" }).filter({ visible: true }).count()) >= 1,
  );

  // ─── Crear la tienda ────────────────────────────────────────────────────────
  const sp = await (await browser.newContext(device)).newPage();
  watch(sp, "vendedor");
  await login(sp, seller, "/cuenta");
  await sp.getByRole("link", { name: "Mi tienda" }).filter({ visible: true }).click();
  await sp.waitForURL(/\/cuenta\/tienda$/);
  await sp.getByLabel("Nombre de la tienda").waitFor();
  ok("Mi cuenta → Mi tienda", true);
  ok(
    "formulario relleno con el nombre y la dirección por defecto",
    (await sp.getByLabel("Nombre de la tienda").inputValue()) === seller.label &&
      (await sp.getByLabel("Dirección de la tienda").inputValue()) ===
        seller.username.replace("_", "-"),
  );
  await sp.getByLabel("Dirección de la tienda").fill("1x");
  await submit(sp, "Crear mi tienda");
  await visible(sp, "empieza por una letra").waitFor();
  ok("dirección con formato inválido → error", true);
  await sp.getByLabel("Dirección de la tienda").fill(`ocupada-${tag}`);
  await submit(sp, "Crear mi tienda");
  await visible(sp, "Esa dirección ya la usa otra tienda.").waitFor();
  ok("dirección de otra tienda → error", true);
  const slug = `tienda-${tag}`;
  await sp.getByLabel("Nombre de la tienda").fill(`Móviles ${tag}`);
  await sp.getByLabel("Dirección de la tienda").fill(`Tienda ${tag}`);
  await sp.getByLabel("Descripción").fill("Móviles nuevos y de segunda mano con garantía.");
  await sp.getByLabel("Dirección", { exact: true }).fill("Calle de Argelia, junto al mercado");
  await sp.getByLabel("Horario").fill("L–V 8:00–18:00");
  await submit(sp, "Crear mi tienda");
  await visible(sp, "¡Tu tienda está publicada!").waitFor();
  const { data: store } = await admin.from("stores").select("*").eq("user_id", seller.id).single();
  ok(
    "tienda creada con la dirección normalizada",
    store?.slug === slug &&
      store.name === `Móviles ${tag}` &&
      store.opening_hours === "L–V 8:00–18:00",
    JSON.stringify(store),
  );

  // Logo y portada.
  await sp
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "logo.webp", mimeType: "image/webp", buffer: photo });
  await sp
    .locator('input[type="file"]')
    .nth(1)
    .setInputFiles({ name: "portada.webp", mimeType: "image/webp", buffer: photo });
  let media;
  for (let i = 0; i < 40; i++) {
    ({ data: media } = await admin
      .from("stores")
      .select("logo_path, cover_path")
      .eq("user_id", seller.id)
      .single());
    if (media.logo_path && media.cover_path) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  ok(
    "logo y portada guardados",
    /\/logo-/.test(media.logo_path ?? "") && /\/cover-/.test(media.cover_path ?? ""),
    JSON.stringify(media),
  );
  ok("…y en Storage", (await mediaFiles(seller.id)).length === 2);
  const r = await admin
    .from("stores")
    .update({ logo_path: `${rival.id}/logo-${crypto.randomUUID()}.webp` })
    .eq("user_id", seller.id);
  ok(
    "la base de datos no deja poner la foto de otro",
    r.error?.message === "store_media_invalid",
    r.error?.message,
  );

  // ─── Página pública ─────────────────────────────────────────────────────────
  const vp = await (await browser.newContext(device)).newPage();
  watch(vp, "visitante", (u) => u.includes(`/t/${slug}`));
  await vp.goto(`${BASE}/t/${slug}`);
  await vp.locator("h1").waitFor();
  const storeText = (await vp.locator("main").innerText()).replace(/\s+/g, " ");
  ok(
    "nombre, insignia, dirección, horario y descripción",
    storeText.includes(`Móviles ${tag}`) &&
      storeText.includes("PREMIUM") &&
      storeText.includes("Calle de Argelia") &&
      storeText.includes("L–V 8:00–18:00") &&
      storeText.includes("con garantía"),
  );
  ok(
    "portada y logo",
    (await vp.locator('main img[src*="/cover-"]').count()) === 1 &&
      (await vp.locator('main img[src*="/logo-"]').count()) === 1,
  );
  ok(
    "pestaña «En venta (2)» con sus 2 anuncios",
    storeText.includes("En venta (2)") &&
      (await vp.locator("main ul li").filter({ hasText: tag }).count()) === 2,
  );
  ok(
    "sin sesión no hay WhatsApp",
    (await vp.getByRole("button", { name: /WhatsApp/ }).count()) === 0,
  );
  const ogImage = await vp.locator('meta[property="og:image"]').getAttribute("content");
  ok(
    "Open Graph con la portada",
    ogImage?.includes("/profile-media/") && ogImage.includes("/cover-"),
    ogImage,
  );
  ok(
    "sin scroll horizontal a 360 px",
    await vp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await vp.getByRole("link", { name: "Vendidos" }).click();
  await vp.waitForURL(/ver=vendidos/);
  await visible(vp, `Móvil vendido ${tag}`).waitFor();
  ok(
    "pestaña «Vendidos»",
    (await vp.locator("main ul li").filter({ hasText: tag }).filter({ visible: true }).count()) ===
      1,
  );

  const listing = listings.find((l) => l.title === `Móvil uno ${tag}`);
  await vp.goto(`${BASE}/anuncio/movil-uno-${tag}-malabo-${listing.code}`);
  const storeLink = vp.getByRole("link", { name: /Ver su tienda/ });
  await storeLink.waitFor();
  ok("la ficha enlaza a la tienda", (await storeLink.getAttribute("href")) === `/t/${slug}`);
  await vp.goto(`${BASE}/u/${seller.username}`);
  ok(
    "el perfil enlaza a la tienda",
    (await vp.getByRole("link", { name: `Ver su tienda: Móviles ${tag}` }).getAttribute("href")) ===
      `/t/${slug}`,
  );
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  ok("la tienda está en el sitemap", sitemap.includes(`/t/${slug}`));

  // ─── WhatsApp con sesión ────────────────────────────────────────────────────
  const bp = await (await browser.newContext(device)).newPage();
  watch(bp, "compradora");
  let waUrl = null;
  await bp.route("https://wa.me/**", (route) => {
    waUrl = route.request().url();
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp</p>" });
  });
  await login(bp, buyer, `/t/${slug}`);
  await bp.getByRole("button", { name: /WhatsApp/ }).click();
  await bp.waitForURL(/wa\.me/);
  const waText = decodeURIComponent(waUrl ?? "");
  ok(
    "con sesión, WhatsApp abre wa.me con la tienda en el mensaje",
    waText.includes(`Móviles ${tag}`) && waText.includes(`/t/${slug}`),
    waText,
  );

  // ─── Premium caducado ───────────────────────────────────────────────────────
  await admin
    .from("profiles")
    .update({ premium_until: new Date(Date.now() - DAY).toISOString() })
    .eq("id", seller.id);
  await sp.goto(`${BASE}/cuenta/tienda`);
  await visible(sp, "Tu tienda no se ve porque tu plan Premium ha caducado").waitFor();
  ok(
    "Premium caducado: lo explica y ofrece renovar",
    (await sp.getByRole("link", { name: "Renovar Premium" }).count()) >= 1,
  );
  const { data: kept } = await admin
    .from("stores")
    .select("slug")
    .eq("user_id", seller.id)
    .single();
  ok("los datos de la tienda se conservan", kept?.slug === slug);
  const { data: hidden } = await createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts)
    .from("stores")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  ok("y deja de ser pública (RLS)", hidden === null);

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) {
    const files = await mediaFiles(id);
    if (files.length)
      await admin.storage.from("profile-media").remove(files.map((f) => `${id}/${f}`));
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
