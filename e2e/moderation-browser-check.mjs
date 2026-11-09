// Fase 1.5 en un navegador móvil real (Chromium, 360 px) contra el servidor de producción local:
// denunciar un anuncio (visitante → entrar → vuelta), auto‑ocultado, denunciar y bloquear desde el chat,
// términos y privacidad, y borrar la cuenta.
// Uso: pnpm e2e moderation-browser-check
import { randomBytes, randomUUID } from "node:crypto";
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
const files = [];
let browser;

async function makeUser(label) {
  const suffix = letters();
  const email = `modnav+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `mn_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, username: `mn_${suffix}`, password, client, label };
}

async function login(page, user) {
  await page.getByLabel("Usuario, email o teléfono").fill(user.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const visibleText = async (page) =>
  (await page.locator("main").filter({ visible: true }).first().innerText()).replace(/\s+/g, " ");

try {
  const seller = await makeUser("Vendedora Moderación");
  const buyer = await makeUser("Comprador Moderación");
  const r2 = await makeUser("Denunciante Dos");
  const r3 = await makeUser("Denunciante Tres");

  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const tag = `zm${letters()}`;
  const newListing = async (title) => {
    const { data, error } = await admin
      .from("listings")
      .insert({
        user_id: seller.id,
        category_id: cat.id,
        city_id: city.id,
        title,
        description: "Prueba de moderación en el navegador.",
        price_xaf: 70000,
        condition: "used",
        attributes: { brand: "Samsung" },
        status: "active",
        published_at: new Date(Date.now() - 400 * 86400000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select("id, code")
      .single();
    if (error) throw error;
    return {
      ...data,
      path: `/anuncio/movil-${tag}-${title.endsWith("dos") ? "dos-" : ""}malabo-${data.code}`,
    };
  };
  const listing = await newListing(`Móvil ${tag}`);
  const listing2 = await newListing(`Móvil ${tag} dos`);

  // Dos denuncias por la base de datos; la tercera, desde el navegador, lo ocultará.
  for (const reporter of [r2, r3]) {
    const r = await reporter.client.rpc("report_listing", {
      p_listing_id: listing.id,
      p_reason: "scam",
    });
    if (r.error) throw r.error;
  }

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
        !known(r.url()) &&
        !(r.status() === 404 && allow404(r.url())) &&
        errors.push(`${who} ${r.status()} ${r.url()}`),
    );
  };

  // ─── Denunciar un anuncio: visitante → entrar → vuelta al formulario ────────
  const buyerContext = await browser.newContext(device);
  const page = await buyerContext.newPage();
  watch(page, "comprador", (u) => u.includes(listing.path));
  await page.goto(`${BASE}${listing.path}`);
  await page.waitForSelector("h1");
  ok(
    "la ficha muestra «Denunciar este anuncio»",
    await page.getByRole("link", { name: "Denunciar este anuncio" }).isVisible(),
  );
  await page.getByRole("link", { name: "Denunciar este anuncio" }).click();
  await page.waitForURL(/\/entrar/);
  ok(
    "sin sesión → entrar, con vuelta a la denuncia",
    decodeURIComponent(page.url()).includes(`next=${listing.path}/denunciar`),
  );
  await login(page, buyer);
  await page.waitForURL((u) => u.pathname === `${listing.path}/denunciar`);
  await page.getByRole("heading", { name: "Denunciar este anuncio" }).waitFor();
  ok("tras entrar, vuelve al formulario de denuncia", true);
  ok("el formulario cita el anuncio", (await visibleText(page)).includes(`Móvil ${tag}`));
  ok("6 motivos", (await page.locator('input[name="reason"]').count()) === 6);
  ok(
    "sin scroll horizontal a 360 px",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  await page.getByLabel(/Otro motivo/).check();
  await page.getByRole("button", { name: "Enviar denuncia" }).click();
  await page.getByText("Explícanos qué pasa.").waitFor();
  ok("«Otro motivo» sin explicación → error junto al campo", true);
  ok("…y el motivo sigue elegido", await page.getByLabel(/Otro motivo/).isChecked());

  await page.getByLabel(/Parece una estafa/).check();
  await page.getByLabel("Cuéntanos más").fill("Pide el pago por adelantado y no deja verlo");
  await page.getByRole("button", { name: "Enviar denuncia" }).click();
  await page.getByText("Denuncia enviada").waitFor();
  ok(
    "denuncia enviada",
    (await visibleText(page)).includes("Revisaremos el anuncio lo antes posible"),
  );
  const { data: stored } = await admin
    .from("reports")
    .select("reason, details")
    .eq("listing_id", listing.id)
    .eq("reporter_id", buyer.id)
    .single();
  ok(
    "guardada con su motivo y explicación",
    stored?.reason === "scam" && stored.details.startsWith("Pide el pago"),
    JSON.stringify(stored),
  );
  const { data: hidden } = await admin
    .from("listings")
    .select("status")
    .eq("id", listing.id)
    .single();
  ok(
    "con la tercera denuncia el anuncio queda en revisión",
    hidden.status === "under_review",
    hidden.status,
  );

  // La caché se invalida: la ficha y la búsqueda dejan de mostrarlo a cualquiera.
  const visitorContext = await browser.newContext(device);
  const visitor = await visitorContext.newPage();
  watch(visitor, "visitante", (u) => u.includes(listing.path));
  const fichaResponse = await visitor.goto(`${BASE}${listing.path}`);
  const fichaText = await visitor.locator("body").innerText();
  ok(
    "la ficha ya no se ve (no encontrado)",
    fichaResponse.status() === 404 || /no existe|no encontr/i.test(fichaText),
    `${fichaResponse.status()} ${fichaText.slice(0, 80)}`,
  );
  await visitor.goto(`${BASE}/buscar?q=${tag}`);
  await visitor.waitForSelector("#resultados");
  const searchText = await visitor.locator("#resultados").innerText();
  ok("la búsqueda solo encuentra el otro anuncio", searchText.includes("1 anuncio"), searchText);

  await page.getByRole("link", { name: "Volver al anuncio" }).click();
  await page.waitForLoadState("networkidle");
  ok("«Volver al anuncio» lleva a la ficha (ya oculta)", page.url().endsWith(listing.path));

  // ─── Denunciar y bloquear desde el chat ─────────────────────────────────────
  const r = await buyer.client.rpc("start_conversation", { p_listing_id: listing2.id });
  const conversationId = r.data;
  await buyer.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Hola, ¿sigue disponible?",
  });
  await seller.client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: "Sí. Envíame 20.000 por adelantado y te lo guardo",
  });

  await page.goto(`${BASE}/mensajes/${conversationId}`);
  await page.locator("summary[aria-label='Más opciones']").filter({ visible: true }).click();
  await page.getByRole("link", { name: `Denunciar a ${seller.label}` }).click();
  await page.waitForURL(/\/denunciar$/);
  await page.getByRole("heading", { name: `Denunciar a ${seller.label}` }).waitFor();
  ok("el menú del chat lleva a «Denunciar a …»", true);
  ok("4 motivos para una persona", (await page.locator('input[name="reason"]').count()) === 4);
  ok(
    "«Bloquear también» viene marcado",
    await page.getByLabel(`Bloquear también a ${seller.label}`).isChecked(),
  );
  await page.getByLabel(/Intenta estafarme/).check();
  await page.getByRole("button", { name: "Enviar denuncia" }).click();
  await page.getByText("Denuncia enviada").waitFor();
  ok(
    "denuncia enviada y bloqueo confirmado",
    (await visibleText(page)).includes(`Has bloqueado a ${seller.label}`),
  );
  const { data: block } = await admin
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", buyer.id);
  ok(
    "el bloqueo está en la base de datos",
    block?.length === 1 && block[0].blocked_id === seller.id,
  );
  await page
    .getByRole("link", { name: "Volver a la conversación" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL((u) => u.pathname === `/mensajes/${conversationId}`);
  await page
    .getByText("Has bloqueado a esta persona")
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  ok(
    "la conversación muestra que está bloqueada",
    await page
      .getByText("Has bloqueado a esta persona")
      .filter({ visible: true })
      .first()
      .isVisible(),
  );

  // ─── Términos y privacidad ──────────────────────────────────────────────────
  await visitor.goto(`${BASE}/terminos`);
  ok("términos: título", (await visitor.locator("h1").innerText()) === "Términos de uso");
  ok("términos: 11 secciones", (await visitor.locator("main section[id]").count()) === 11);
  await visitor.getByRole("link", { name: /Qué no se puede anunciar/ }).click();
  ok("el índice salta a la sección", visitor.url().endsWith("#prohibido"));
  ok(
    "enlace de email",
    (await visitor.locator('a[href="mailto:hello@bklnsoftware.tech"]').count()) >= 1,
  );
  await visitor.goto(`${BASE}/privacidad`);
  ok("privacidad: título", (await visitor.locator("h1").innerText()) === "Política de privacidad");
  ok(
    "sin scroll horizontal a 360 px",
    await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await visitor.goto(`${BASE}/registro`);
  const termsLink = await visitor.locator('a[href="/terminos"]').count();
  const privacyLink = await visitor.locator('a[href="/privacidad"]').count();
  ok("el registro enlaza a términos y privacidad", termsLink === 1 && privacyLink === 1);
  await visitor.goto(`${BASE}/`);
  ok(
    "el inicio tiene los enlaces al pie",
    (await visitor.locator('footer a[href="/terminos"]').count()) === 1,
  );
  // Antes del lanzamiento el sitemap solo trae las tiendas reales y sus anuncios (D-081).
  const prelaunch = (await (await fetch(`${BASE}/robots.txt`)).text()).includes("Allow: /t/");
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  ok(
    prelaunch
      ? "sitemap antes del lanzamiento: sin términos ni privacidad"
      : "sitemap con términos y privacidad",
    prelaunch
      ? !sitemap.includes("/terminos") && !sitemap.includes("/privacidad")
      : sitemap.includes("/terminos") && sitemap.includes("/privacidad"),
  );

  // ─── Borrar la cuenta (la vendedora) ────────────────────────────────────────
  const imageId = randomUUID();
  const base = `${seller.id}/${listing2.id}/${imageId}`;
  for (const variant of ["l", "t"]) {
    await admin.storage
      .from("listing-images")
      .upload(`${base}-${variant}.webp`, TINY_WEBP, { contentType: "image/webp" });
    files.push(`${base}-${variant}.webp`);
  }
  await admin
    .from("listing_images")
    .insert({ id: imageId, listing_id: listing2.id, storage_path: base, width: 1, height: 1 });

  const sellerContext = await browser.newContext(device);
  const sp = await sellerContext.newPage();
  watch(sp, "vendedora");
  // Se visitan antes su perfil y su anuncio para que queden en la caché.
  await sp.goto(`${BASE}/u/${seller.username}`);
  ok(
    "su perfil público se ve antes de borrar",
    (await sp.locator("h1").innerText()) === seller.label,
  );
  await sp.goto(`${BASE}${listing2.path}`);
  await sp.waitForSelector("h1");

  await sp.goto(`${BASE}/entrar?next=/cuenta`);
  await login(sp, seller);
  await sp.waitForURL(/\/cuenta$/);
  await sp.getByRole("link", { name: "Borrar mi cuenta" }).filter({ visible: true }).click();
  await sp.waitForURL(/\/cuenta\/borrar$/);
  // El contenido va en un <Suspense>: se espera al aviso.
  await sp.getByText("Esto no se puede deshacer").filter({ visible: true }).first().waitFor();
  ok("Mi cuenta → Borrar mi cuenta", (await visibleText(sp)).includes("Esto no se puede deshacer"));
  await sp.getByLabel("Escribe tu contraseña para confirmar").fill("contraseña-mala");
  await sp.getByRole("button", { name: "Borrar mi cuenta para siempre" }).click();
  await sp.getByText("La contraseña no es correcta.").waitFor();
  ok("con una contraseña mala no se borra", true);
  const { data: stillThere } = await admin
    .from("profiles")
    .select("id")
    .eq("id", seller.id)
    .maybeSingle();
  ok("…y la cuenta sigue ahí", stillThere !== null);

  await sp.getByLabel("Escribe tu contraseña para confirmar").fill(seller.password);
  await sp.getByRole("button", { name: "Borrar mi cuenta para siempre" }).click();
  await sp.waitForURL(/\/cuenta-borrada$/);
  ok(
    "con la contraseña buena → «Tu cuenta se ha borrado»",
    (await sp.locator("h1").filter({ visible: true }).innerText()) === "Tu cuenta se ha borrado",
  );
  users.splice(users.indexOf(seller.id), 1);

  const { data: authUser } = await admin.auth.admin.getUserById(seller.id);
  ok("el usuario ya no existe en Auth", !authUser?.user);
  const cookies = await sellerContext.cookies();
  ok(
    "sin cookies de sesión en el navegador",
    !cookies.some((c) => c.name.includes("-auth-token")),
    cookies.map((c) => c.name).join(","),
  );
  await sp.goto(`${BASE}/cuenta`);
  await sp.waitForURL(/\/entrar/);
  ok("Mi cuenta pide entrar otra vez", true);

  const profileResponse = await visitor.goto(`${BASE}/u/${seller.username}`);
  const profileText = await visitor.locator("body").innerText();
  ok(
    "su perfil público desaparece al momento (caché invalidada)",
    profileResponse.status() === 404 || /no existe|no encontr/i.test(profileText),
    `${profileResponse.status()}`,
  );
  const listingResponse = await visitor.goto(`${BASE}${listing2.path}`);
  ok(
    "su anuncio también",
    listingResponse.status() === 404 ||
      /no existe|no encontr/i.test(await visitor.locator("body").innerText()),
  );

  let left = [];
  for (let i = 0; i < 10; i++) {
    const { data } = await admin.rpc("account_storage_objects", { p_user_id: seller.id });
    left = data ?? [];
    if (left.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  ok("sus fotos se borran de Storage", left.length === 0, `${left.length} ficheros`);
  if (left.length === 0) files.length = 0;

  await page.goto(`${BASE}/mensajes/${conversationId}`);
  await page
    .getByText("Usuario eliminado")
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  ok(
    "el comprador conserva la conversación, con «Usuario eliminado»",
    await page.getByText("Usuario eliminado").filter({ visible: true }).first().isVisible(),
  );
  ok(
    "…y sus mensajes",
    (await visibleText(page).catch(() => "")).includes("20.000 por adelantado") ||
      (await page.locator("body").innerText()).includes("20.000 por adelantado"),
  );

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  if (files.length) await admin.storage.from("listing-images").remove(files);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
