// Catálogo y ajustes del panel (1.6, segunda parte) en un navegador móvil (Chromium, 360 px).
// Deja la configuración como estaba: borra lo que crea y restaura los ajustes que cambia.
// Uso: pnpm e2e admin-catalog-browser-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
const created = { categories: [], cities: [] };
let browser;
let tagForCleanup = "sin-etiqueta";

// Para restaurar al final.
const { data: termsBefore } = await admin
  .from("app_settings")
  .select("value")
  .eq("key", "banned_terms")
  .single();
const { data: premiumBefore } = await admin
  .from("plans")
  .select("max_photos")
  .eq("id", "premium")
  .single();

async function makeUser(label, { isAdmin = false } = {}) {
  const suffix = letters();
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `catalogo+${suffix}@bklnmarketplace.com`,
    password,
    email_confirm: true,
    user_metadata: {
      username: `ca_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  if (isAdmin)
    await admin.from("profile_private").update({ role: "admin" }).eq("user_id", data.user.id);
  return { id: data.user.id, username: `ca_${suffix}`, password };
}

try {
  const tag = letters();
  tagForCleanup = tag;
  const boss = await makeUser("Admin Catálogo", { isAdmin: true });
  const normal = await makeUser("Normal");

  browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const device = {
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    locale: "es-GQ",
  };
  const errors = [];
  const login = async (page, user, next) => {
    await page.goto(`${BASE}/entrar?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Usuario, email o teléfono").fill(user.username);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === next);
  };

  const np = await (await browser.newContext(device)).newPage();
  await login(np, normal, "/admin/catalogo");
  await np.getByText("Esta página no existe").first().waitFor();
  ok("el catálogo del panel no existe para quien no es admin", true);

  const page = await (await browser.newContext(device)).newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !m.text().startsWith("Failed to load resource") &&
      errors.push(`console: ${m.text()}`),
  );
  page.on(
    "response",
    (r) =>
      r.status() >= 400 &&
      !r.url().includes("/_vercel/insights/") &&
      !(r.status() === 404 && r.url().includes("/categoria/prueba")) &&
      errors.push(`${r.status()} ${r.url()}`),
  );
  const visible = (text) => page.getByText(text).filter({ visible: true }).first();
  // Next deja montadas (ocultas) las páginas anteriores: siempre el campo visible.
  const v = (selector) => page.locator(selector).filter({ visible: true }).first();
  const submit = async (name, scope = page) => {
    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().startsWith(BASE),
      ),
      scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click(),
    ]);
    await page.waitForTimeout(300);
  };

  await login(page, boss, "/admin");
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await page.waitForURL(/\/admin\/catalogo$/);
  await visible("Vehículos").waitFor();
  ok("pestaña Catálogo con las categorías", true);
  ok(
    "sin scroll horizontal a 360 px",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  // ─── Categoría principal y subcategoría ─────────────────────────────────────
  await page.getByRole("link", { name: "+ Nueva principal" }).click();
  await v("#category-name").waitFor();
  await v("#category-name").fill(`Prueba ${tag}`);
  await v("#category-icon").selectOption("sofa");
  await v("#category-order").fill("900");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await page.waitForURL(/\/admin\/catalogo\/categoria\/\d+$/);
  const rootId = Number(page.url().split("/").pop());
  created.categories.push(rootId);
  const { data: root } = await admin
    .from("categories")
    .select("slug, icon, parent_id, is_active")
    .eq("id", rootId)
    .single();
  ok(
    "crear principal: slug sacado del nombre, icono y activa",
    root.slug === `prueba-${tag}` &&
      root.icon === "sofa" &&
      root.parent_id === null &&
      root.is_active,
    JSON.stringify(root),
  );

  await page.getByRole("link", { name: "+ Nueva subcategoría" }).click();
  await page.getByRole("heading", { name: `Nueva subcategoría de Prueba ${tag}` }).waitFor();
  ok(
    "la subcategoría no lleva icono",
    (await v("#category-icon").filter({ visible: true }).count()) === 0,
  );
  await v("#category-name").fill(`Muebles ${tag}`);
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await page.waitForURL(
    (u) =>
      /\/admin\/catalogo\/categoria\/\d+$/.test(u.pathname) && !u.pathname.endsWith(`/${rootId}`),
  );
  const subId = Number(page.url().split("/").pop());
  created.categories.unshift(subId);
  const { data: sub } = await admin
    .from("categories")
    .select("slug, parent_id")
    .eq("id", subId)
    .single();
  ok(
    "crear subcategoría dentro de la principal",
    sub.parent_id === rootId && sub.slug === `muebles-${tag}`,
    JSON.stringify(sub),
  );

  // ─── Atributos ──────────────────────────────────────────────────────────────
  const newAttr = page;
  await v("#attribute-new-label").fill("Material");
  await v("#attribute-new-key").fill("material");
  await v("#attribute-new-type").selectOption("select");
  await v("#attribute-new-options").fill("Madera");
  await v("#attribute-new-filterable").check();
  await submit("Añadir atributo", newAttr);
  await visible("Una lista necesita al menos 2 opciones.").waitFor();
  ok("una lista con una sola opción → error", true);
  await v("#attribute-new-label").fill("Material");
  await v("#attribute-new-key").fill("material");
  await v("#attribute-new-type").selectOption("select");
  await v("#attribute-new-options").fill("Madera\nMetal\nMadera");
  await v("#attribute-new-filterable").check();
  await submit("Añadir atributo", newAttr);
  await visible("Atributo añadido.").waitFor();
  const { data: attr } = await admin
    .from("category_attributes")
    .select("id, key, options, is_filterable")
    .eq("category_id", subId)
    .single();
  ok(
    "atributo creado, con las opciones sin repetir",
    attr?.key === "material" &&
      JSON.stringify(attr.options) === '["Madera","Metal"]' &&
      attr.is_filterable,
    JSON.stringify(attr),
  );
  await v("#attribute-new-label").fill("Otro");
  await v("#attribute-new-key").fill("material");
  await v("#attribute-new-type").selectOption("text");
  await submit("Añadir atributo", newAttr);
  await visible("Ya hay un atributo con esa clave").waitFor();
  ok("clave repetida → error", true);

  await page.locator("summary").filter({ hasText: "Material" }).click();
  await page.locator(`#attribute-${attr.id}-label`).fill("Material principal");
  await submit("Guardar", page.locator("details").filter({ hasText: "material" }));
  await visible("Atributo guardado.").waitFor();
  const { data: renamed } = await admin
    .from("category_attributes")
    .select("label")
    .eq("id", attr.id)
    .single();
  ok("editar el atributo", renamed.label === "Material principal");

  const visitor = await (await browser.newContext(device)).newPage();
  await visitor.goto(`${BASE}/categoria/muebles-${tag}`);
  await visitor.locator("h1").waitFor();
  // Los filtros llegan en streaming después del título: se espera a que estén en la página.
  const filter = await visitor
    .getByText("Material principal")
    .first()
    .waitFor({ state: "attached", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  ok(
    "la subcategoría nueva ya sale en la web, con su filtro",
    (await visitor.locator("h1").innerText()) === `Muebles ${tag}` && filter,
    (await visitor.content()).includes("Material") ? "sale «Material» sin renombrar" : "sin filtro",
  );

  // Desactivar la principal desactiva también la subcategoría.
  await page.goto(`${BASE}/admin/catalogo/categoria/${rootId}`);
  await v("#category-active").uncheck();
  await submit("Guardar", page.locator("form").filter({ visible: true }).first());
  await visible("Categoría guardada.").waitFor();
  const { data: both } = await admin
    .from("categories")
    .select("id, is_active")
    .in("id", [rootId, subId]);
  ok(
    "desactivar la principal desactiva sus subcategorías",
    both.every((c) => !c.is_active),
    JSON.stringify(both),
  );
  const gone = await visitor.goto(`${BASE}/categoria/muebles-${tag}`);
  await visitor.waitForTimeout(1000);
  ok(
    "…y desaparecen de la web",
    gone.status() === 404 ||
      (await visitor.locator("body").innerText()).includes("Esta página no existe"),
  );

  await page.goto(`${BASE}/admin/catalogo/categoria/${subId}`);
  await page.locator("summary").filter({ hasText: "Material" }).click();
  await submit("Eliminar este atributo", page.locator("details"));
  const { count: attrsLeft } = await admin
    .from("category_attributes")
    .select("id", { count: "exact", head: true })
    .eq("category_id", subId);
  ok("eliminar el atributo", attrsLeft === 0, String(attrsLeft));

  // ─── Ciudades ───────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/admin/catalogo`);
  await v("#new-city-name").fill(`Prueba ${tag}`);
  await submit("Añadir ciudad");
  await visible("Ciudad añadida.").waitFor();
  const { data: city } = await admin
    .from("cities")
    .select("id, slug, is_active")
    .eq("slug", `prueba-${tag}`)
    .single();
  if (city) created.cities.push(city.id);
  ok("añadir una ciudad (slug del nombre)", city?.is_active === true, JSON.stringify(city));
  await page
    .locator(`a[href="/admin/catalogo/ciudad/${city.id}"]`)
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(/\/admin\/catalogo\/ciudad\/\d+$/);
  await v("#city-active").uncheck();
  await submit("Guardar", page.locator("form").filter({ visible: true }).first());
  await visible("Ciudad guardada.").waitFor();
  const { data: cityAfter } = await admin
    .from("cities")
    .select("is_active")
    .eq("id", city.id)
    .single();
  ok("desactivar la ciudad", cityAfter.is_active === false);

  // ─── Ajustes ────────────────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await page.waitForURL(/\/admin\/ajustes$/);
  const premiumPlan = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#premium-photos") });
  await v("#premium-photos").fill(String(premiumBefore.max_photos + 1));
  await submit("Guardar", premiumPlan);
  await visible("Límites guardados.").waitFor();
  const { data: plan } = await admin
    .from("plans")
    .select("max_photos")
    .eq("id", "premium")
    .single();
  ok("cambiar un límite del plan", plan.max_photos === premiumBefore.max_photos + 1);
  await v("#premium-photos").fill("99");
  await submit("Guardar", premiumPlan);
  await visible("Revisa los números").waitFor();
  ok("límite fuera de rango → error", true);

  const newPrice = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#price-new-months") });
  await v("#price-new-months").fill("2");
  await v("#price-new-price").fill("9.900");
  await submit("Añadir periodo", newPrice);
  await visible("Precio guardado.").waitFor();
  const { data: price2 } = await admin
    .from("plan_prices")
    .select("price_xaf, is_active")
    .eq("plan_id", "premium")
    .eq("months", 2)
    .single();
  ok("añadir un periodo de precio", price2?.price_xaf === 9900 && price2.is_active);
  const price2Form = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#price-2") });
  await price2Form.getByLabel("Se ofrece").uncheck();
  await submit("Guardar", price2Form);
  await visible("Precio guardado.").waitFor();
  const { data: price2b } = await admin
    .from("plan_prices")
    .select("is_active")
    .eq("plan_id", "premium")
    .eq("months", 2)
    .single();
  ok("retirar un periodo (casilla sin marcar)", price2b.is_active === false);

  const officeForm = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#office-name") });
  await submit("Guardar", officeForm);
  await visible("Datos de la oficina guardados.").waitFor();
  const { data: office } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "office")
    .single();
  ok(
    "guardar la oficina sin cambios no rompe nada (WhatsApp normalizado)",
    office.value.payments_whatsapp === "+240555220846",
    JSON.stringify(office.value),
  );

  const termsForm = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#banned-terms") });
  const current = await v("#banned-terms").inputValue();
  await v("#banned-terms").fill(`${current}\nPalabraPrueba${tag}\npalabraprueba${tag}`);
  await submit("Guardar", termsForm);
  await visible("Términos prohibidos guardados.").waitFor();
  const { data: terms } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "banned_terms")
    .single();
  ok(
    "añadir un término (en minúsculas y sin repetir)",
    terms.value.filter((x) => x === `palabraprueba${tag}`).length === 1 &&
      terms.value.length === termsBefore.value.length + 1,
  );

  const thresholdForm = page
    .locator("form")
    .filter({ visible: true })
    .filter({ has: page.locator("#report-threshold") });
  await v("#report-threshold").fill("0");
  await submit("Guardar", thresholdForm);
  await visible("El umbral debe ser un número de 1 a 20.").waitFor();
  ok("umbral de denuncias fuera de rango → error", true);

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  await admin.from("app_settings").update({ value: termsBefore.value }).eq("key", "banned_terms");
  await admin.from("plans").update({ max_photos: premiumBefore.max_photos }).eq("id", "premium");
  await admin.from("plan_prices").delete().eq("plan_id", "premium").eq("months", 2);
  for (const id of created.categories) await admin.from("categories").delete().eq("id", id);
  // Por si una prueba a medias dejó alguna más (primero las subcategorías).
  const { data: stray } = await admin
    .from("categories")
    .select("id, parent_id")
    .like("slug", `%-${tagForCleanup}`);
  for (const c of (stray ?? []).sort(
    (a, b) => Number(b.parent_id !== null) - Number(a.parent_id !== null),
  ))
    await admin.from("categories").delete().eq("id", c.id);
  for (const id of created.cities) await admin.from("cities").delete().eq("id", id);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const { data: restored } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "banned_terms")
    .single();
  console.log(
    `(configuración restaurada: ${JSON.stringify(restored.value) === JSON.stringify(termsBefore.value) ? "sí" : "NO"})`,
  );
}

finish();
