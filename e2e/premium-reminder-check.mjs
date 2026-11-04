// Aviso de Premium por caducar (1.6): cron diario /api/cron/daily y avisos en Mi cuenta y Mis anuncios.
// El servidor local tiene que arrancar con el mismo CRON_SECRET (por defecto, prueba-local-cron):
//   CRON_SECRET=prueba-local-cron pnpm start -p 3100
// Uso: pnpm e2e premium-reminder-check [CRON_SECRET]
import { randomBytes } from "node:crypto";
import { BASE, CHROMIUM_PATH, chromium, crash, createClient, env, finish, ok } from "./lib.mjs";

const SECRET = process.argv[2] ?? "prueba-local-cron";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const DAY = 86400000;

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const users = [];
let browser;

async function makeUser(label, premiumOffsetDays) {
  const suffix = letters();
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `aviso+${suffix}@bklnmarketplace.com`,
    password,
    email_confirm: true,
    user_metadata: {
      username: `av_${suffix}`,
      display_name: label,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  const premiumUntil =
    premiumOffsetDays === null
      ? null
      : new Date(Date.now() + premiumOffsetDays * DAY).toISOString();
  if (premiumUntil)
    await admin.from("profiles").update({ premium_until: premiumUntil }).eq("id", data.user.id);
  return { id: data.user.id, username: `av_${suffix}`, password, premiumUntil };
}
const logRows = async (id) =>
  (await admin.from("notification_log").select("kind, ref, channel").eq("user_id", id)).data ?? [];

try {
  if (!SECRET) throw new Error("Falta el CRON_SECRET del servidor local");
  const soon = await makeUser("Caduca pronto", 3);
  const later = await makeUser("Caduca tarde", 20);
  const expired = await makeUser("Ya caducó", -2);
  const normal = await makeUser("Normal", null);

  // ─── Cron ───────────────────────────────────────────────────────────────────
  let res = await fetch(`${BASE}/api/cron/daily`);
  ok("sin el secreto → 401", res.status === 401, String(res.status));
  res = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: "Bearer otro" } });
  ok("con otro secreto → 401", res.status === 401, String(res.status));
  res = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${SECRET}` } });
  const body = await res.json().catch(() => null);
  ok(
    "con el secreto → 200 y resumen",
    res.status === 200 && typeof body?.premium?.due === "number",
    JSON.stringify(body),
  );
  const soonLog = await logRows(soon.id);
  ok(
    "avisa a quien caduca en 3 días (apuntado con la fecha de fin)",
    soonLog.length === 1 &&
      soonLog[0].kind === "premium_expiring" &&
      soonLog[0].ref === soon.premiumUntil.slice(0, 10) &&
      soonLog[0].channel === "push",
    JSON.stringify(soonLog),
  );
  ok(
    "no a quien caduca en 20 días, ni a quien ya caducó, ni a un Normal",
    (await logRows(later.id)).length === 0 &&
      (await logRows(expired.id)).length === 0 &&
      (await logRows(normal.id)).length === 0,
  );
  res = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${SECRET}` } });
  ok(
    "el día siguiente no repite el aviso",
    res.status === 200 && (await logRows(soon.id)).length === 1,
  );

  // Al renovar cambia la fecha de fin: el periodo nuevo tendrá su propio aviso.
  const renewed = new Date(Date.now() + 5 * DAY).toISOString();
  await admin.from("profiles").update({ premium_until: renewed }).eq("id", soon.id);
  await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${SECRET}` } });
  ok("con otra fecha de fin, vuelve a avisar una vez", (await logRows(soon.id)).length === 2);

  // ─── Avisos en la web ───────────────────────────────────────────────────────
  browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const device = { viewport: { width: 360, height: 740 }, isMobile: true, locale: "es-GQ" };
  const textOf = async (user, path) => {
    const page = await (await browser.newContext(device)).newPage();
    await page.goto(`${BASE}/entrar?next=${encodeURIComponent(path)}`);
    await page.getByLabel("Usuario, email o teléfono").fill(user.username);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === path);
    // El contenido va en un <Suspense>: se espera al @usuario (Mi cuenta) o al uso del plan (Mis anuncios).
    await page
      .getByText(path === "/cuenta" ? `@${user.username}` : "anuncios activos")
      .filter({ visible: true })
      .first()
      .waitFor();
    await page.waitForTimeout(500);
    return (await page.locator("main").filter({ visible: true }).first().innerText()).replace(
      /\s+/g,
      " ",
    );
  };
  const soonText = await textOf(soon, "/cuenta");
  ok(
    "Mi cuenta: «Tu Premium caduca en 5 días» con «Renovar Premium»",
    soonText.includes("Tu Premium caduca en 5 días") && soonText.includes("Renovar Premium"),
    soonText.slice(0, 300),
  );
  const laterText = await textOf(later, "/mis-anuncios");
  ok("sin aviso si quedan más de 7 días", !laterText.includes("Tu Premium caduca"));
  const expiredText = await textOf(expired, "/mis-anuncios");
  ok(
    "Mis anuncios: explica que caducó, la pausa y la tienda",
    expiredText.includes("Tu Premium caducó el") &&
      expiredText.includes("más de 10 anuncios activos"),
    expiredText.slice(0, 300),
  );
  const normalText = await textOf(normal, "/cuenta");
  ok("a un Normal no se le enseña nada", !normalText.includes("Tu Premium"));
} catch (error) {
  crash(error);
} finally {
  await browser?.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

finish();
