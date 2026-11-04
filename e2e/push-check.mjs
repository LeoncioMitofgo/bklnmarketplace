// Notificaciones push de extremo a extremo: Chrome real (headless, perfil temporal) para la vendedora,
// Chromium para el comprador. Uso: pnpm e2e push-check
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
const closers = [];
const profileDir = mkdtempSync(join(tmpdir(), "bkln-push-"));

function sessionCookies(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const base = { domain: "localhost", path: "/", httpOnly: false, sameSite: "Lax" };
  const CHUNK = 3180;
  if (value.length <= CHUNK) return [{ ...base, name, value }];
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++)
    parts.push({ ...base, name: `${name}.${i}`, value: value.slice(i * CHUNK, (i + 1) * CHUNK) });
  return parts;
}

async function makeUser(label) {
  const suffix = letters();
  const email = `push+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `push_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { data: login } = await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, cookies: sessionCookies(login.session) };
}

try {
  const seller = await makeUser("Vendedora Avisos");
  const buyer = await makeUser("Comprador Avisos");
  const { data: cat } = await admin.from("categories").select("id").eq("slug", "moviles").single();
  const { data: listing } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cat.id,
      title: `Móvil avisos ${letters()}`,
      description: "Prueba de avisos push.",
      price_xaf: 50000,
      condition: "used",
      attributes: { brand: "Samsung" },
      status: "active",
      published_at: new Date(Date.now() - 400 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select("id, code")
    .single();

  // ─── Vendedora en Chrome: activa los avisos ────────────────────────────────
  const sellerContext = await chromium.launchPersistentContext(profileDir, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    viewport: { width: 360, height: 740 },
  });
  closers.push(() => sellerContext.close());
  await sellerContext.addCookies(seller.cookies);
  const sellerPage = sellerContext.pages()[0] ?? (await sellerContext.newPage());
  if (process.env.DEBUG_PUSH) {
    sellerPage.on("console", (m) =>
      console.log("      [consola]", m.type(), m.text().slice(0, 200)),
    );
    sellerPage.on("response", async (r) => {
      if (r.request().method() === "POST")
        console.log(
          "      [POST]",
          r.status(),
          r.url().slice(0, 80),
          (await r.text().catch(() => "")).slice(0, 120),
        );
    });
  }
  await sellerPage.goto(`${BASE}/mensajes`);
  const prompt = sellerPage
    .getByRole("button", { name: "Activar avisos" })
    .filter({ visible: true });
  await prompt.waitFor({ timeout: 15000 }).catch(() => {});
  ok("la bandeja invita a activar los avisos", await prompt.isVisible());

  await sellerContext.grantPermissions(["notifications"], { origin: BASE });
  await prompt.click();
  let saved = null;
  const started = Date.now();
  for (let i = 0; i < 60 && !saved; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const { data } = await admin
      .from("push_subscriptions")
      .select("endpoint, last_used_at")
      .eq("user_id", seller.id)
      .maybeSingle();
    saved = data;
  }
  ok(
    "la suscripción de este navegador se guarda",
    Boolean(saved),
    "no se guardó (¿servicio de push no disponible en headless?)",
  );
  if (saved)
    console.log(
      `      servicio de push: ${new URL(saved.endpoint).host}, guardada en ${Math.round((Date.now() - started) / 1000)} s`,
    );
  ok("la invitación desaparece", !(await prompt.isVisible()));

  // ─── Comprador en Chromium: escribe ────────────────────────────────────────
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
  });
  closers.push(() => browser.close());
  const buyerContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await buyerContext.addCookies(buyer.cookies);
  const buyerPage = await buyerContext.newPage();
  await buyerPage.goto(`${BASE}/mensajes/anuncio/${listing.code}`);
  await buyerPage.getByRole("button", { name: "Hola, ¿sigue disponible?" }).click();
  await buyerPage.waitForURL(/\/mensajes\/[0-9a-f-]{36}/);
  const conversationPath = new URL(buyerPage.url()).pathname;

  // ─── Llega el aviso ─────────────────────────────────────────────────────────
  // FCM solo responde 201 si las claves VAPID y el cifrado son correctos; entonces se apunta last_used_at.
  let used = null;
  for (let i = 0; i < 20 && !used?.last_used_at; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ({ data: used } = await admin
      .from("push_subscriptions")
      .select("last_used_at")
      .eq("user_id", seller.id)
      .maybeSingle());
  }
  ok(
    "el servidor envía el aviso y FCM lo acepta (VAPID y cifrado correctos)",
    Boolean(used?.last_used_at),
  );

  // Chrome sin ventana no recibe de FCM ni enseña notificaciones: se entrega el mismo aviso al
  // service worker por CDP y se intercepta showNotification para ver con qué lo llama.
  const worker =
    sellerContext.serviceWorkers()[0] ?? (await sellerContext.waitForEvent("serviceworker"));
  await worker.evaluate(() => {
    self.__shown = [];
    self.registration.showNotification = async (title, options) => {
      self.__shown.push({ title, ...options });
    };
  });
  const cdp = await sellerContext.newCDPSession(sellerPage);
  const registrations = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => registrations.push(...e.registrations));
  await cdp.send("ServiceWorker.enable");
  await new Promise((r) => setTimeout(r, 1500));
  const registration = registrations.find((r) => r.scopeURL.startsWith(BASE));
  const deliver = (data) =>
    cdp.send("ServiceWorker.deliverPushMessage", {
      origin: `${BASE}/`,
      registrationId: registration.registrationId,
      data: JSON.stringify(data),
    });
  const payload = {
    title: "Comprador Avisos",
    body: "Hola, ¿sigue disponible?",
    url: conversationPath,
    tag: "cprueba",
  };
  await deliver(payload);
  await new Promise((r) => setTimeout(r, 1500));
  const shown = await worker.evaluate(() => self.__shown);
  const notification = shown[0];
  ok("el service worker muestra la notificación", Boolean(notification), "no la mostró");
  ok(
    "…con el nombre, el mensaje y el enlace a la conversación",
    notification?.title === payload.title &&
      notification.body === payload.body &&
      notification.data?.url === conversationPath,
    JSON.stringify(notification),
  );
  ok(
    "…con los iconos de la marca y una sola por conversación",
    notification?.icon === "/icons/icon-192.png" &&
      notification.badge === "/icons/badge-96.png" &&
      notification.tag === "cprueba" &&
      notification.renotify === true,
  );

  // Preferencia desactivada: no se envía.
  await admin.from("profile_private").update({ notify_push: false }).eq("user_id", seller.id);
  await worker.evaluate(() => {
    self.__shown = [];
  });
  await buyerPage
    .getByRole("textbox", { name: "Escribe un mensaje" })
    .filter({ visible: true })
    .fill("¿Hola?");
  await buyerPage
    .getByRole("button", { name: "Enviar", exact: true })
    .filter({ visible: true })
    .click();
  await new Promise((r) => setTimeout(r, 8000));
  const { data: afterPref } = await admin
    .from("push_subscriptions")
    .select("last_used_at")
    .eq("user_id", seller.id)
    .maybeSingle();
  ok(
    "con los avisos desactivados en su cuenta, no se envía nada",
    afterPref?.last_used_at === used?.last_used_at,
    `${afterPref?.last_used_at} vs ${used?.last_used_at}`,
  );
  await admin.from("profile_private").update({ notify_push: true }).eq("user_id", seller.id);

  // ─── Mi cuenta: desactivar en este móvil ───────────────────────────────────
  await sellerPage.goto(`${BASE}/cuenta`);
  await sellerPage
    .getByText("Activados: te avisaremos")
    .filter({ visible: true })
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  ok(
    "Mi cuenta muestra los avisos activados",
    await sellerPage.getByText("Activados: te avisaremos").filter({ visible: true }).isVisible(),
  );
  await sellerPage
    .getByRole("button", { name: "Desactivar en este móvil" })
    .filter({ visible: true })
    .click();
  await sellerPage
    .getByText("Desactivados en este móvil.")
    .filter({ visible: true })
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", seller.id);
  ok("desactivar borra la suscripción", count === 0, String(count));
} catch (error) {
  crash(error);
} finally {
  for (const close of closers.reverse()) await close().catch(() => {});
  rmSync(profileDir, { recursive: true, force: true });
  for (const id of users) {
    const { data: convs } = await admin
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${id},seller_id.eq.${id}`);
    for (const c of convs ?? []) await admin.from("conversations").delete().eq("id", c.id);
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
