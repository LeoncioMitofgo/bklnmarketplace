// Emails de anuncio por caducar y caducado (D-074): el cron diario, solo esa tarea (?only=listings).
// El servidor tiene que arrancar con CRON_SECRET=prueba-local-cron. Sin RESEND_API_KEY en local, el
// email se escribe en la consola del servidor en lugar de enviarse.
// Ojo: apunta en notification_log los avisos de todos los vendedores con anuncios por caducar, y en
// local no se envían. No lanzarla con usuarios reales hasta tener el proyecto de desarrollo.
import { randomBytes } from "node:crypto";
import { BASE, crash, createClient, env, finish, ok } from "./lib.mjs";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SECRET = process.argv[2] ?? "prueba-local-cron";
const DAY = 86_400_000;
const users = [];

async function seller(name, { verified = true, premium = false } = {}) {
  const suffix = randomBytes(3).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({
    email: `caduca+${suffix}@bklnmarketplace.com`,
    password: `Prueba-${randomBytes(6).toString("hex")}`,
    email_confirm: true,
    user_metadata: {
      username: `caduca_${suffix}`,
      display_name: name,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  if (verified) {
    await admin
      .from("profile_private")
      .update({ email_verified_at: new Date().toISOString(), notify_email: true })
      .eq("user_id", data.user.id);
  }
  if (premium) {
    await admin
      .from("profiles")
      .update({ premium_until: new Date(Date.now() + 30 * DAY).toISOString() })
      .eq("id", data.user.id);
  }
  return data.user.id;
}

// Los anuncios van en una subcategoría.
const { data: category } = await admin
  .from("categories")
  .select("id")
  .not("parent_id", "is", null)
  .limit(1)
  .single();
const { data: city } = await admin.from("cities").select("id").eq("slug", "malabo").single();

async function listing(userId, title, status, inDays) {
  const { data, error } = await admin
    .from("listings")
    .insert({
      user_id: userId,
      category_id: category.id,
      city_id: city.id,
      title,
      description: "Anuncio de la prueba de caducidad.",
      price_xaf: 50000,
      is_negotiable: false,
      status,
      first_published_at: new Date(Date.now() - 28 * DAY).toISOString(),
      published_at: new Date(Date.now() - 28 * DAY).toISOString(),
      expires_at: new Date(Date.now() + inDays * DAY).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`listing ${title}: ${error.message}`);
  return data.id;
}

const logRows = async (userId) =>
  (
    await admin
      .from("notification_log")
      .select("kind, ref, channel")
      .eq("user_id", userId)
      .in("kind", ["listing_expiring", "listing_expired"])
  ).data ?? [];
const cron = () =>
  fetch(`${BASE}/api/cron/daily?only=listings`, {
    headers: { authorization: `Bearer ${SECRET}` },
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

try {
  const normal = await seller("Caduca Normal");
  const premium = await seller("Caduca Premium", { premium: true });
  const unverified = await seller("Caduca Sin Verificar", { verified: false });
  const soon = await listing(normal, "Móvil por caducar", "active", 2);
  const gone = await listing(normal, "Tablet caducada", "expired", -1);
  const later = await listing(normal, "Móvil con tiempo", "active", 10);
  await listing(premium, "Móvil de tienda", "active", 2);
  await listing(unverified, "Móvil sin email", "active", 2);

  const first = await cron();
  ok(
    "el cron responde con el resumen de los emails",
    first.status === 200 && typeof first.body?.listings?.sent === "number" && !first.body.premium,
    JSON.stringify(first.body),
  );
  const rows = await logRows(normal);
  ok(
    "apunta el anuncio por caducar y el caducado, por email",
    rows.length === 2 &&
      rows.every((r) => r.channel === "email") &&
      rows.some((r) => r.kind === "listing_expiring" && r.ref.startsWith(`${soon}:`)) &&
      rows.some((r) => r.kind === "listing_expired" && r.ref.startsWith(`${gone}:`)),
    JSON.stringify(rows),
  );
  ok("no avisa del que aún tiene tiempo", !rows.some((r) => r.ref.startsWith(`${later}:`)));
  ok("no avisa a Premium, que se renueva solo", (await logRows(premium)).length === 0);
  ok("ni a quien no ha confirmado el email", (await logRows(unverified)).length === 0);

  const second = await cron();
  ok(
    "al día siguiente no repite",
    second.status === 200 &&
      second.body?.listings?.sent === 0 &&
      (await logRows(normal)).length === 2,
    JSON.stringify(second.body),
  );
} catch (error) {
  crash(error);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
finish();
