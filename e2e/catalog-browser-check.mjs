// Prueba en un navegador móvil real (Chromium, 360 px) de lo interactivo del catálogo:
// "Ver más", hoja de filtros (#filtros), atrás de Android, favorito sin sesión → entrar → vuelta, botón Volver.
// Uso: pnpm e2e catalog-browser-check
import { randomBytes } from "node:crypto";
import {
  BASE,
  CHROMIUM_PATH,
  chromium,
  crash,
  createClient,
  env,
  finish,
  ok,
  watchErrors,
} from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const tag = `zq${letters()}`;
const users = [];
let browser;

try {
  const make = async (label) => {
    const suffix = letters();
    const email = `navegador+${suffix}@bklnmarketplace.com`;
    const password = `Prueba-${randomBytes(6).toString("hex")}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: `nav_${suffix}`,
        display_name: label,
        phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
      },
    });
    if (error) throw error;
    users.push(data.user.id);
    return { id: data.user.id, username: `nav_${suffix}`, email, password };
  };
  const seller = await make("Vendedor Navegador");
  const buyer = await make("Compradora Navegador");

  const [{ data: phones }, { data: cities }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id, slug").in("slug", ["malabo", "bata"]),
  ]);
  const cityId = (slug) => cities.find((c) => c.slug === slug).id;
  const old = (days) => new Date(Date.now() - days * 86400000).toISOString();
  // 21 anuncios (uno más que una página), publicados "hace días" para no tapar los recientes reales.
  const rows = Array.from({ length: 21 }, (_, i) => ({
    user_id: seller.id,
    category_id: phones.id,
    title: `Móvil ${tag} número ${i + 1}`,
    description: "Prueba automática del navegador.",
    price_xaf: 10000 + i * 1000,
    condition: "used",
    city_id: cityId(i < 6 ? "bata" : "malabo"),
    attributes: { brand: "Samsung" },
    status: "active",
    first_published_at: old(40 + i),
    published_at: old(40 + i),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  }));
  const { error: insertError } = await admin.from("listings").insert(rows);
  if (insertError) throw insertError;

  browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-GQ",
  });
  const page = await context.newPage();
  const errors = [];
  watchErrors(page, errors);

  // ─── Búsqueda y "Ver más" ──────────────────────────────────────────────────
  await page.goto(`${BASE}/buscar?q=${tag}`);
  await page.waitForSelector("#r20");
  ok(
    "primera página: 20 resultados",
    (await page.locator("[id^=r]").filter({ hasText: tag }).count()) === 20,
  );
  ok(
    "contador «21 anuncios»",
    (await page.locator("#resultados").innerText()).includes("21 anuncios"),
  );
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  ok("sin scroll horizontal a 360 px", noOverflow);
  await page.evaluate(() => {
    window.__sinRecargar = true;
  });
  await page.getByRole("link", { name: "Ver 1 más" }).click();
  await page.waitForSelector("#r21");
  ok(
    "«Ver más» carga el 21 sin recargar la página",
    (await page.evaluate(() => window.__sinRecargar)) === true,
  );
  ok("la URL lleva n=2", page.url().includes("n=2"));

  // ─── Hoja de filtros ───────────────────────────────────────────────────────
  const sheet = page.locator("#filtros");
  ok("la hoja de filtros empieza cerrada", !(await sheet.isVisible()));
  await page.getByRole("link", { name: /^Filtros/ }).click();
  ok("«Filtros» abre la hoja", await sheet.isVisible());
  await page.goBack();
  ok("el botón atrás la cierra", !(await sheet.isVisible()));
  ok(
    "…sin recargar ni perder la página",
    (await page.evaluate(() => window.__sinRecargar)) === true && page.url().includes("n=2"),
  );

  await page.getByRole("link", { name: /^Filtros/ }).click();
  await sheet.getByLabel("Ciudad").selectOption("bata");
  await sheet.getByRole("button", { name: "Ver resultados" }).click();
  await page.waitForURL(/ciudad=bata/);
  await page.waitForFunction(() =>
    document.querySelector("#resultados")?.textContent?.includes("6 anuncios"),
  );
  ok("aplicar filtros: ciudad Bata → 6 anuncios", true);
  ok("la hoja se cierra al aplicar", !(await sheet.isVisible()));
  ok("chip de Bata", await page.getByRole("link", { name: "Quitar filtro: Bata" }).isVisible());
  ok(
    "aplicar filtros no recarga la página",
    (await page.evaluate(() => window.__sinRecargar)) === true,
  );
  await page.goBack();
  await page.waitForFunction(() =>
    document.querySelector("#resultados")?.textContent?.includes("21 anuncios"),
  );
  ok(
    "atrás tras aplicar: vuelve a la búsqueda anterior, con la hoja cerrada",
    page.url().includes("n=2") && !page.url().includes("#filtros") && !(await sheet.isVisible()),
  );
  await page.goForward();
  await page.waitForFunction(() =>
    document.querySelector("#resultados")?.textContent?.includes("6 anuncios"),
  );
  await page.getByRole("link", { name: "Quitar filtro: Bata" }).click();
  await page.waitForFunction(() =>
    document.querySelector("#resultados")?.textContent?.includes("21 anuncios"),
  );
  ok("quitar el chip vuelve a 21", !page.url().includes("ciudad="));

  await page.getByRole("link", { name: /^Filtros/ }).click();
  await sheet.getByRole("link", { name: "Cerrar filtros" }).first().click();
  ok(
    "la ✕ cierra la hoja y quita #filtros",
    !(await sheet.isVisible()) && !page.url().includes("#filtros"),
  );
  await page.goBack();
  ok("…y atrás no la vuelve a abrir", !(await sheet.isVisible()));
  await page.goForward();

  // ─── Ficha, Volver y favorito sin sesión ──────────────────────────────────
  await page.locator("#r1").click();
  await page.waitForURL(/\/anuncio\//);
  await page.waitForSelector("h1");
  const fichaUrl = page.url();
  ok("la ficha abre desde la lista", (await page.locator("h1").innerText()).includes(tag));
  await page.getByRole("link", { name: "Volver" }).click();
  await page.waitForURL(/\/buscar/);
  ok("«Volver» regresa a los resultados", page.url().includes(`q=${tag}`));

  await page.goto(fichaUrl);
  await page.getByRole("button", { name: "Guardar en favoritos" }).click();
  await page.waitForURL(/\/entrar/);
  ok(
    "favorito sin sesión → entrar",
    decodeURIComponent(page.url()).includes(`next=${new URL(fichaUrl).pathname}`),
  );

  await page.getByLabel("Usuario, email o teléfono").fill(buyer.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(buyer.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname === new URL(fichaUrl).pathname);
  ok("tras entrar, vuelve a la ficha", true);
  // Se espera a que termine la Server Action (mientras tanto el corazón ya se ve marcado).
  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Guardar en favoritos" }).click(),
  ]);
  ok("la Server Action responde bien", saveResponse.ok(), String(saveResponse.status()));
  await page.waitForSelector('button[aria-pressed="true"]');
  ok("el corazón queda marcado", true);
  const { count } = await admin
    .from("favorites")
    .select("listing_id", { count: "exact", head: true })
    .eq("user_id", users[1]);
  ok("el favorito está en la base de datos", count === 1, String(count));

  await page.goto(`${BASE}/favoritos`);
  await page
    .getByText(tag)
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  const favText = await page.locator("main").filter({ visible: true }).innerText();
  ok("aparece en /favoritos", favText.includes(tag), favText.slice(0, 200).replace(/\s+/g, " "));
  await page.getByRole("button", { name: "Quitar de favoritos" }).click();
  await page.waitForFunction(() =>
    document.querySelector("main")?.textContent?.includes("Aún no tienes favoritos"),
  );
  ok("quitarlo desde /favoritos", true);

  // ─── Inicio ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/`);
  ok(
    "inicio: rejilla de 12 categorías",
    (await page.locator('a[href^="/categoria/"]').count()) >= 12,
  );
  await page.getByRole("link", { name: "Vehículos" }).click();
  await page.waitForURL(/\/categoria\/vehiculos/);
  ok("categoría desde el inicio", (await page.locator("h1").innerText()) === "Vehículos");

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
