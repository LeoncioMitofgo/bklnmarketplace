// Editar el perfil y la cuenta (1.6, segunda parte) en un navegador móvil (Chromium, 360 px):
// foto de perfil (subir, cambiar, quitar), nombre/usuario/ciudad/descripción con sus errores,
// y email, teléfono y contraseña con la contraseña actual.
// Uso: pnpm e2e profile-browser-check
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
let browser;

async function makeUser(label) {
  const suffix = letters();
  const email = `perfil+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `pf_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", data.user.id);
  return { id: data.user.id, username: `pf_${suffix}`, email, password, phone, label };
}
const avatarFiles = async (userId) =>
  ((await admin.storage.from("profile-media").list(userId)).data ?? []).map((f) => f.name);

try {
  const me = await makeUser("Perfil Original");
  const other = await makeUser("Otra Cuenta");

  // Una foto real (de los datos de demostración) para subirla como foto de perfil.
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

  browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    locale: "es-GQ",
  });
  const page = await context.newPage();
  const errors = [];
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
      !(r.status() === 404 && r.url().includes(`/u/${me.username}`)) &&
      errors.push(`${r.status()} ${r.url()}`),
  );
  const visible = (text) => page.getByText(text).filter({ visible: true }).first();

  await page.goto(`${BASE}/entrar?next=/cuenta`);
  await page.getByLabel("Usuario, email o teléfono").fill(me.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(me.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/cuenta$/);
  await page.getByRole("link", { name: "Editar perfil" }).filter({ visible: true }).click();
  await page.waitForURL(/\/cuenta\/perfil$/);
  await page.getByLabel("Nombre visible").waitFor();
  ok("Mi cuenta → Editar perfil", true);
  ok(
    "sin scroll horizontal a 360 px",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  // ─── Foto de perfil ─────────────────────────────────────────────────────────
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "yo.webp", mimeType: "image/webp", buffer: photo });
  await visible("Cambiar la foto").waitFor({ timeout: 30000 });
  let { data: prof } = await admin.from("profiles").select("avatar_path").eq("id", me.id).single();
  const first = prof.avatar_path;
  ok(
    "subir la foto: se guarda en el perfil",
    /^[0-9a-f-]{36}\/avatar-[0-9a-f-]{36}\.(webp|jpg)$/.test(first ?? ""),
    first,
  );
  let files = await avatarFiles(me.id);
  ok("…y en Storage, una sola", files.length === 1 && first.endsWith(files[0]), files.join(","));
  const meta = (await admin.storage.from("profile-media").list(me.id)).data?.[0]?.metadata;
  ok("…recortada y ligera (menos de 80 KB)", meta?.size < 80 * 1024, String(meta?.size));

  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "otra.webp", mimeType: "image/webp", buffer: photo });
  for (let i = 0; i < 20; i++) {
    ({ data: prof } = await admin.from("profiles").select("avatar_path").eq("id", me.id).single());
    if (prof.avatar_path && prof.avatar_path !== first) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  files = await avatarFiles(me.id);
  ok(
    "cambiar la foto: la nueva sustituye a la anterior y esta se borra",
    prof.avatar_path !== first && files.length === 1,
    files.join(","),
  );

  const r = await (async () => {
    const client = createClient(url, pub, opts);
    await client.auth.signInWithPassword({ email: me.email, password: me.password });
    return client
      .from("profiles")
      .update({ avatar_path: `${other.id}/avatar-${crypto.randomUUID()}.webp` })
      .eq("id", me.id);
  })();
  ok(
    "la base de datos no deja apuntar a la foto de otro",
    r.error?.message === "avatar_invalid",
    r.error?.message,
  );

  await page.getByRole("button", { name: "Quitar la foto" }).click();
  await visible("Poner una foto").waitFor();
  ({ data: prof } = await admin.from("profiles").select("avatar_path").eq("id", me.id).single());
  ok("quitar la foto", prof.avatar_path === null && (await avatarFiles(me.id)).length === 0);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "yo.webp", mimeType: "image/webp", buffer: photo });
  await visible("Cambiar la foto").waitFor({ timeout: 30000 });

  // ─── Perfil público ─────────────────────────────────────────────────────────
  // Espera la respuesta de la Server Action: el error del envío anterior puede seguir a la vista.
  const submit = async (name) => {
    await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().startsWith(BASE),
      ),
      page.getByRole("button", { name }).click(),
    ]);
    await page.waitForTimeout(300);
  };
  const save = () => submit("Guardar cambios");
  await page.getByLabel("Nombre de usuario").fill(other.username);
  await save();
  await visible("Ese nombre de usuario ya está en uso.").waitFor();
  ok("usuario de otra persona → error", true);
  await page.getByLabel("Nombre de usuario").fill("admin");
  await save();
  await visible("Ese nombre de usuario ya está en uso.").waitFor();
  ok("usuario reservado → error", true);
  await page.getByLabel("Nombre de usuario").fill("1nombre");
  await save();
  await visible("empieza por una letra").waitFor();
  ok("usuario con formato inválido → error", true);

  const newUsername = `pf_${letters()}`;
  await page.getByLabel("Nombre visible").fill("Nombre Nuevo");
  await page.getByLabel("Nombre de usuario").fill(newUsername.toUpperCase());
  await page.getByLabel("Ciudad").selectOption({ label: "Bata" });
  await page.getByLabel("Sobre ti").fill("Vendo móviles y accesorios en Bata.");
  await save();
  await visible("Cambios guardados.").waitFor();
  const { data: saved } = await admin
    .from("profiles")
    .select("display_name, username, bio, city:cities(name)")
    .eq("id", me.id)
    .single();
  ok(
    "guardar: nombre, usuario (en minúsculas), ciudad y descripción",
    saved.display_name === "Nombre Nuevo" &&
      saved.username === newUsername &&
      saved.city?.name === "Bata" &&
      saved.bio.startsWith("Vendo"),
    JSON.stringify(saved),
  );

  const visitor = await (
    await browser.newContext({ viewport: { width: 360, height: 740 } })
  ).newPage();
  await visitor.goto(`${BASE}/u/${newUsername}`);
  await visitor.locator("h1").waitFor();
  const profileText = await visitor.locator("main").innerText();
  ok(
    "el perfil público ya está en la dirección nueva, con foto, ciudad y descripción",
    (await visitor.locator("h1").innerText()) === "Nombre Nuevo" &&
      profileText.includes("Bata") &&
      profileText.includes("Vendo móviles") &&
      (await visitor.locator('main img[src*="/profile-media/"]').count()) === 1,
  );
  const oldResponse = await visitor.goto(`${BASE}/u/${me.username}`);
  await visitor.waitForTimeout(1500);
  ok(
    "la dirección antigua ya no existe (caché invalidada)",
    oldResponse.status() === 404 ||
      (await visitor.locator("body").innerText()).includes("Esta página no existe"),
  );

  // ─── Email, teléfono y contraseña ───────────────────────────────────────────
  await page.goto(`${BASE}/cuenta`);
  await page
    .getByRole("link", { name: "Email, teléfono y contraseña" })
    .filter({ visible: true })
    .click();
  await page.waitForURL(/\/cuenta\/acceso$/);
  await page.getByLabel("Nuevo email").waitFor();
  ok("Mi cuenta → Email, teléfono y contraseña", true);

  const newEmail = `perfil+${letters()}@bklnmarketplace.com`;
  await page.getByLabel("Nuevo email").fill(other.email);
  await page.locator("#access-email-password").fill(me.password);
  await submit("Cambiar el email");
  await visible("Ya hay una cuenta con este email.").waitFor();
  ok("email de otra cuenta → error", true);
  await page.getByLabel("Nuevo email").fill(newEmail);
  await page.locator("#access-email-password").fill("mala-contraseña");
  await submit("Cambiar el email");
  await visible("La contraseña actual no es correcta.").waitFor();
  ok("con la contraseña actual mal → error", true);
  await page.locator("#access-email-password").fill(me.password);
  await submit("Cambiar el email");
  await visible("Email cambiado.").waitFor();
  const { data: authUser } = await admin.auth.admin.getUserById(me.id);
  const { data: priv } = await admin
    .from("profile_private")
    .select("email_verified_at")
    .eq("user_id", me.id)
    .single();
  ok(
    "email cambiado y pendiente de confirmar",
    authUser.user.email === newEmail && priv.email_verified_at === null,
    `${authUser.user.email} ${priv.email_verified_at}`,
  );
  await page.goto(`${BASE}/cuenta`);
  await visible(newEmail).waitFor();
  ok(
    "Mi cuenta enseña ya el email nuevo, sin confirmar",
    (await page.locator("main").filter({ visible: true }).innerText()).includes("Sin confirmar"),
  );
  me.email = newEmail;

  await page.goto(`${BASE}/cuenta/acceso`);
  await page.getByLabel("Nuevo teléfono").waitFor();
  await page.getByLabel("Nuevo teléfono").fill(me.phone.slice(4));
  await page.locator("#access-phone-password").fill(me.password);
  await submit("Cambiar el teléfono");
  await visible("Ese ya es tu teléfono.").waitFor();
  ok("el mismo teléfono → error", true);
  await page.getByLabel("Nuevo teléfono").fill(other.phone.slice(4));
  await page.locator("#access-phone-password").fill(me.password);
  await submit("Cambiar el teléfono");
  await visible("Ya hay una cuenta con este teléfono.").waitFor();
  ok("teléfono de otra cuenta → error", true);
  const newPhone = `555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  await page
    .getByLabel("Nuevo teléfono")
    .fill(`${newPhone.slice(0, 3)} ${newPhone.slice(3, 6)} ${newPhone.slice(6)}`);
  await page.locator("#access-phone-password").fill(me.password);
  await submit("Cambiar el teléfono");
  await visible("Teléfono cambiado.").waitFor();
  const { data: phoneRow } = await admin
    .from("profile_private")
    .select("phone")
    .eq("user_id", me.id)
    .single();
  ok("teléfono cambiado y normalizado", phoneRow.phone === `+240${newPhone}`, phoneRow.phone);

  const otherDevice = createClient(url, pub, opts);
  await otherDevice.auth.signInWithPassword({ email: me.email, password: me.password });
  const newPassword = `Nueva-${randomBytes(5).toString("hex")}`;
  await page.locator("#access-password-current").fill(me.password);
  await page.locator("#access-password-new").fill("corta");
  await submit("Cambiar la contraseña");
  await visible("entre 8 y 72 caracteres").waitFor();
  ok("contraseña nueva demasiado corta → error", true);
  await page.locator("#access-password-current").fill(me.password);
  await page.locator("#access-password-new").fill(newPassword);
  await submit("Cambiar la contraseña");
  await visible("Contraseña cambiada.").waitFor();
  const check = createClient(url, pub, opts);
  const { error: newLogin } = await check.auth.signInWithPassword({
    email: me.email,
    password: newPassword,
  });
  const { error: oldLogin } = await createClient(url, pub, opts).auth.signInWithPassword({
    email: me.email,
    password: me.password,
  });
  ok("la contraseña nueva vale y la vieja no", !newLogin && Boolean(oldLogin));
  const { error: refreshError } = await otherDevice.auth.refreshSession();
  ok("la sesión del otro dispositivo se cierra", Boolean(refreshError), refreshError?.message);
  await page.goto(`${BASE}/cuenta`);
  await visible(newEmail).waitFor();
  ok("este móvil sigue dentro", true);

  // Solo cuentan los fallos: hasta aquí ha habido uno y varios aciertos. Con 5 fallos se bloquea.
  await page.goto(`${BASE}/cuenta/acceso`);
  await page.locator("#access-password-current").waitFor();
  for (let i = 0; i < 4; i++) {
    await page.locator("#access-password-current").fill(`mala-${i}`);
    await page.locator("#access-password-new").fill("OtraNueva-123456");
    await submit("Cambiar la contraseña");
  }
  await visible("La contraseña actual no es correcta.").waitFor();
  await page.locator("#access-password-current").fill(newPassword);
  await page.locator("#access-password-new").fill("OtraNueva-123456");
  await submit("Cambiar la contraseña");
  await visible("Demasiados intentos").waitFor();
  ok("con 5 fallos se bloquea, aunque la siguiente sea buena", true);

  ok("sin errores de JavaScript ni peticiones fallidas", errors.length === 0, errors.join(" | "));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) {
    const files = await avatarFiles(id);
    if (files.length)
      await admin.storage.from("profile-media").remove(files.map((f) => `${id}/${f}`));
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
