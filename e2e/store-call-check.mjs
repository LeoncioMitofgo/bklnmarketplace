// Teléfono para llamadas de las tiendas Premium y tiendas reales abiertas a Google antes del
// lanzamiento (D-081): base de datos, páginas sin sesión, sitemap y robots, y el editor y el botón
// «Llamar» en un navegador móvil (Chromium, 360 px). Contra un servidor local (pnpm start -p 3100)
// sin SITE_INDEXABLE.
// Uso: pnpm e2e store-call-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
const DAY = 86400000;
const PHONE = "+240222111222";
const PHONE_SHOWN = "+240 222 111 222";

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

async function makeUser(label, { premium = false, demo = false, cityId = null } = {}) {
  const suffix = letters();
  const email = `llamadas+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `ll_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  await admin
    .from("profiles")
    .update({
      premium_until: premium ? new Date(Date.now() + 30 * DAY).toISOString() : null,
      is_demo: demo,
      city_id: cityId,
    })
    .eq("id", data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { data: login } = await client.auth.signInWithPassword({ email, password });
  const cookies = sessionCookies(login.session);
  return {
    id: data.user.id,
    username: `ll_${suffix}`,
    client,
    cookies,
    header: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}

// `html` sin los <script> (llevan los textos de next-intl y los datos de RSC); `jsonLd` aparte.
const get = async (path, cookie) => {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
  const body = await res.text();
  return {
    status: res.status,
    body,
    html: body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    jsonLd: [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    ),
  };
};
const robotsMeta = (body) => body.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "";
const calls = async (storeUserId) =>
  (
    await admin
      .from("call_clicks")
      .select("listing_id")
      .eq("store_user_id", storeUserId)
      .order("id")
  ).data ?? [];
async function waitForCalls(storeUserId, n) {
  for (let i = 0; i < 25; i++) {
    const rows = await calls(storeUserId);
    if (rows.length >= n) return rows;
    await new Promise((r) => setTimeout(r, 200));
  }
  return calls(storeUserId);
}

try {
  const tag = letters();
  const [{ data: cat }, { data: city }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "moviles").single(),
    admin.from("cities").select("id").eq("slug", "malabo").single(),
  ]);
  const seller = await makeUser(`Vendedor ${tag}`, { premium: true, cityId: city.id });
  const demo = await makeUser("Tienda Demo", { premium: true, demo: true, cityId: city.id });
  const buyer = await makeUser("Comprador");
  await admin.from("profile_private").update({ show_whatsapp: true }).eq("user_id", seller.id);

  const listing = (userId, title) =>
    admin
      .from("listings")
      .insert({
        user_id: userId,
        category_id: cat.id,
        city_id: city.id,
        title,
        description: "Prueba del teléfono para llamadas.",
        price_xaf: 90000,
        condition: "new",
        attributes: { brand: "Samsung" },
        status: "active",
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
      })
      .select("id, code")
      .single()
      .then((r) => {
        if (r.error) throw r.error;
        return r.data;
      });
  const item = await listing(seller.id, `Movil llamada ${tag}`);
  const demoItem = await listing(demo.id, `Movil demo ${tag}`);
  const demoSlug = `demo-${tag}`;
  await admin.from("stores").insert({ user_id: demo.id, slug: demoSlug, name: `Demo ${tag}` });

  // ─── Base de datos ─────────────────────────────────────────────────────────

  const { error: demoFlag } = await seller.client
    .from("profiles")
    .update({ is_demo: true })
    .eq("id", seller.id);
  ok("el usuario no puede cambiar is_demo", demoFlag?.code === "42501", demoFlag?.code);

  const { error: direct } = await anon
    .from("call_clicks")
    .insert({ store_user_id: demo.id, listing_id: null });
  ok("nadie apunta llamadas directamente en la tabla", direct !== null, direct?.code);
  const { data: readable } = await buyer.client.from("call_clicks").select("id");
  ok("ni las lee", (readable ?? []).length === 0);

  await anon.rpc("register_call", { p_store_user_id: demo.id });
  ok("una tienda sin teléfono para llamadas no suma llamadas", (await calls(demo.id)).length === 0);

  // ─── El editor de la tienda, en el navegador ───────────────────────────────

  browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const mobile = { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true };
  const sellerContext = await browser.newContext(mobile);
  await sellerContext.addCookies(seller.cookies);
  const sp = await sellerContext.newPage();
  const slug = `llamadas-${tag}`;

  await sp.goto(`${BASE}/cuenta/tienda`);
  await sp.getByLabel("Nombre de la tienda").fill(`Llamadas ${tag}`);
  await sp.getByLabel("Dirección de la tienda").fill(slug);
  await sp.getByLabel("Dirección", { exact: true }).fill("Calle de Argelia");
  const phoneField = sp.getByLabel("Teléfono para llamadas");
  ok(
    "el editor tiene el teléfono para llamadas, con su explicación",
    (await phoneField.isVisible()) &&
      (await sp.getByText("también sin cuenta y en Google").isVisible()),
  );
  await phoneField.fill("12345");
  await Promise.all([
    sp.waitForResponse((r) => r.request().method() === "POST"),
    sp.getByRole("button", { name: "Crear mi tienda" }).click(),
  ]);
  await sp.getByText("Escribe un teléfono de Guinea Ecuatorial de 9 cifras").waitFor();
  ok("un teléfono mal escrito no se guarda", true);
  await phoneField.fill("222 111 222");
  await Promise.all([
    sp.waitForResponse((r) => r.request().method() === "POST"),
    sp.getByRole("button", { name: "Crear mi tienda" }).click(),
  ]);
  await sp.getByText("Ver mi tienda").first().waitFor();
  let { data: store } = await admin
    .from("stores")
    .select("call_phone")
    .eq("user_id", seller.id)
    .single();
  ok("guardado en formato +240", store?.call_phone === PHONE, store?.call_phone);
  await sp.reload();
  ok(
    "al volver al editor sale sin el +240",
    (await sp.getByLabel("Teléfono para llamadas").inputValue()) === "222 111 222",
  );

  const { error: badPhone } = await seller.client
    .from("stores")
    .update({ call_phone: "+24012" })
    .eq("user_id", seller.id);
  ok("la base de datos rechaza otro formato", badPhone?.code === "23514", badPhone?.code);
  const { data: publicStore } = await anon
    .from("stores")
    .select("call_phone")
    .eq("slug", slug)
    .single();
  ok("el teléfono para llamadas es público", publicStore?.call_phone === PHONE);

  // ─── Páginas sin sesión ────────────────────────────────────────────────────

  const storePage = await get(`/t/${slug}`);
  ok("la tienda enseña el número", storePage.html.includes(PHONE_SHOWN));
  ok("…y «Llamar» con un enlace tel:", storePage.html.includes(`href="tel:${PHONE}"`));
  ok(
    "título con la ciudad",
    storePage.body.includes(`<title>Llamadas ${tag}, tienda en Malabo · `),
    storePage.body.match(/<title>[^<]*/)?.[0],
  );
  const storeLd = storePage.jsonLd.map((j) => JSON.parse(j)).find((d) => d["@type"] === "Store");
  ok(
    "datos de negocio (Store) con el teléfono, la dirección y el país",
    storeLd?.telephone === PHONE &&
      storeLd?.address?.addressLocality === "Malabo" &&
      storeLd?.address?.addressCountry === "GQ",
    JSON.stringify(storeLd),
  );

  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  const prelaunch = robots.includes("Allow: /t/");
  ok("robots.txt antes del lanzamiento: solo tiendas y anuncios", prelaunch, robots);
  if (prelaunch) {
    ok(
      "una tienda real se deja indexar",
      robotsMeta(storePage.body) === "index, follow",
      robotsMeta(storePage.body),
    );
    const demoPage = await get(`/t/${demoSlug}`);
    ok(
      "una de demostración, no",
      demoPage.status === 200 && robotsMeta(demoPage.body).includes("noindex"),
      robotsMeta(demoPage.body),
    );
    const home = await get("/");
    ok("el inicio, tampoco", robotsMeta(home.body).includes("noindex"));
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    ok(
      "el sitemap trae la tienda real y su anuncio, pero no la de demostración ni el inicio",
      sitemap.includes(`/t/${slug}<`) &&
        sitemap.includes(`-${item.code}<`) &&
        !sitemap.includes(`/t/${demoSlug}<`) &&
        !sitemap.includes(`-${demoItem.code}<`) &&
        !/<loc>[^<]*\/<\/loc>/.test(sitemap),
    );
  }

  const search = await get(`/buscar?q=${tag}`);
  const pathOf = (code) => search.html.match(new RegExp(`href="(/anuncio/[^"]*-${code})"`))?.[1];
  const itemPage = await get(pathOf(item.code));
  ok(
    "la ficha lleva «Llamar» en la barra",
    itemPage.html.includes(`href="tel:${PHONE}"`) && itemPage.html.includes('aria-label="Llamar"'),
  );
  if (prelaunch) ok("…y se deja indexar", robotsMeta(itemPage.body) === "index, follow");
  const demoItemPage = await get(pathOf(demoItem.code));
  ok(
    "la ficha de demostración: sin «Llamar» y sin indexar",
    !demoItemPage.html.includes("tel:") && robotsMeta(demoItemPage.body).includes("noindex"),
  );

  // ─── «Llamar» en el navegador, sin sesión ──────────────────────────────────

  const visitor = await browser.newContext(mobile);
  // El tel: no se abre en Chromium sin interfaz: se corta la navegación, no el clic de React.
  await visitor.addInitScript(() => {
    window.addEventListener(
      "click",
      (e) => {
        if (e.target instanceof Element && e.target.closest('a[href^="tel:"]')) e.preventDefault();
      },
      true,
    );
  });
  const vp = await visitor.newPage();
  await vp.goto(`${BASE}/t/${slug}`);
  await vp.getByRole("link", { name: "Llamar" }).click();
  let rows = await waitForCalls(seller.id, 1);
  ok("pulsar «Llamar» en la tienda apunta una llamada", rows.length === 1, JSON.stringify(rows));
  ok("…sin anuncio", rows[0]?.listing_id === null);

  await vp.goto(`${BASE}${pathOf(item.code)}`);
  await vp.getByRole("link", { name: "Llamar" }).click();
  rows = await waitForCalls(seller.id, 2);
  ok("en la ficha también, con su anuncio", rows[1]?.listing_id === item.id, JSON.stringify(rows));

  // ─── La barra de la ficha con los tres botones, a 360 px ───────────────────

  const buyerContext = await browser.newContext(mobile);
  await buyerContext.addCookies(buyer.cookies);
  const bp = await buyerContext.newPage();
  await bp.goto(`${BASE}${pathOf(item.code)}`);
  const bar = bp.locator("div.fixed.bottom-0").filter({ visible: true }).last();
  await bar.getByRole("button", { name: "WhatsApp" }).waitFor();
  const fits = await bar.evaluate((el) => {
    const buttons = [...el.querySelectorAll("a, button")].filter((b) => b.offsetParent);
    return {
      count: buttons.length,
      page: document.documentElement.scrollWidth,
      inside: buttons.every((b) => b.getBoundingClientRect().right <= window.innerWidth),
      noOverflow: buttons.every((b) => b.scrollWidth <= b.clientWidth),
    };
  });
  ok(
    "con sesión: Llamar, WhatsApp y Chatear caben a 360 px",
    fits.count === 3 && fits.page <= 360 && fits.inside && fits.noOverflow,
    JSON.stringify(fits),
  );

  const before = (await calls(seller.id)).length;
  await sp.goto(`${BASE}${pathOf(item.code)}`);
  await sp.getByRole("link", { name: "Editar mi anuncio" }).waitFor();
  ok(
    "el vendedor en su ficha no ve «Llamar»",
    (await sp.getByRole("link", { name: "Llamar" }).filter({ visible: true }).count()) === 0,
  );
  await seller.client.rpc("register_call", { p_store_user_id: seller.id });
  ok("sus propias llamadas no cuentan", (await calls(seller.id)).length === before);

  await anon.rpc("register_call", { p_store_user_id: seller.id, p_listing_id: demoItem.id });
  rows = await waitForCalls(seller.id, before + 1);
  ok(
    "un anuncio de otra persona no se apunta a esta tienda",
    rows.length === before + 1 && rows.at(-1)?.listing_id === null,
    JSON.stringify(rows.at(-1)),
  );

  // Quitar el teléfono: vacío → null y el botón desaparece.
  await sp.goto(`${BASE}/cuenta/tienda`);
  await sp.getByLabel("Teléfono para llamadas").fill("");
  await Promise.all([
    sp.waitForResponse((r) => r.request().method() === "POST"),
    sp.getByRole("button", { name: "Guardar cambios" }).click(),
  ]);
  await sp.getByText("Cambios guardados").first().waitFor();
  ({ data: store } = await admin
    .from("stores")
    .select("call_phone")
    .eq("user_id", seller.id)
    .single());
  ok("al vaciarlo se quita", store?.call_phone === null, store?.call_phone);
  const without = await get(`/t/${slug}`);
  ok("y la tienda ya no enseña el número", !without.html.includes("tel:"));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
