// Email de mensajes sin leer (D-076): /api/cron/unread, que con Vercel Pro irá cada 15 minutos.
// El servidor tiene que arrancar con CRON_SECRET=prueba-local-cron. Sin RESEND_API_KEY en local, el
// email se escribe en la consola del servidor en lugar de enviarse.
// El cron apunta en notification_log los avisos de todos los que tengan mensajes sin leer, y en local
// no se envían: al terminar se quitan los de quien no es de la prueba, para que no cuenten como enviados.
import { randomBytes } from "node:crypto";
import { BASE, crash, createClient, env, finish, ok } from "./lib.mjs";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SECRET = process.argv[2] ?? "prueba-local-cron";
const MINUTE = 60_000;
const users = [];
const conversations = [];
const started = new Date().toISOString();

async function person(name) {
  const suffix = randomBytes(3).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({
    email: `sinleer+${suffix}@bklnmarketplace.com`,
    password: `Prueba-${randomBytes(6).toString("hex")}`,
    email_confirm: true,
    user_metadata: {
      username: `sinleer_${suffix}`,
      display_name: name,
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString(), notify_email: true })
    .eq("user_id", data.user.id);
  return data.user.id;
}

// Una conversación sobre un anuncio del vendedor, con un mensaje de `from` de hace `minutesAgo`.
async function chat(seller, buyer, from, minutesAgo, body) {
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .not("parent_id", "is", null)
    .limit(1)
    .single();
  const { data: city } = await admin.from("cities").select("id").eq("slug", "malabo").single();
  const { data: listing, error } = await admin
    .from("listings")
    .insert({
      user_id: seller,
      category_id: category.id,
      city_id: city.id,
      title: "Nevera de la prueba",
      description: "Anuncio de la prueba de mensajes sin leer.",
      price_xaf: 90000,
      is_negotiable: false,
      status: "active",
      first_published_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 1440 * MINUTE).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`listing: ${error.message}`);
  const { data: conversation, error: convError } = await admin
    .from("conversations")
    .insert({ listing_id: listing.id, buyer_id: buyer, seller_id: seller })
    .select("id")
    .single();
  if (convError) throw new Error(`conversation: ${convError.message}`);
  conversations.push(conversation.id);
  await message(conversation.id, from, minutesAgo, body);
  return conversation.id;
}

async function message(conversationId, from, minutesAgo, body) {
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: from,
    body,
    created_at: new Date(Date.now() - minutesAgo * MINUTE).toISOString(),
  });
  if (error) throw new Error(`message: ${error.message}`);
}

const logRows = async (userId) =>
  (
    await admin
      .from("notification_log")
      .select("id, ref")
      .eq("user_id", userId)
      .eq("kind", "unread_messages")
      .eq("channel", "email")
  ).data ?? [];
const cron = () =>
  fetch(`${BASE}/api/cron/unread`, { headers: { authorization: `Bearer ${SECRET}` } }).then(
    async (r) => ({ status: r.status, body: await r.json().catch(() => null) }),
  );

try {
  const seller = await person("Vendedora Sin Leer");
  const buyer = await person("Comprador Sin Leer");
  const reader = await person("Vendedor Que Lee");
  const waiting = await chat(seller, buyer, buyer, 20, "¿Sigue disponible la nevera?");
  await chat(buyer, seller, seller, 5, "Te lo miro y te digo"); // reciente: aún no toca
  const read = await chat(reader, buyer, buyer, 20, "¿Me la guardas?");
  await admin
    .from("conversations")
    .update({ seller_last_read_at: new Date().toISOString() })
    .eq("id", read);

  ok("sin el secreto → 401", (await fetch(`${BASE}/api/cron/unread`)).status === 401);
  const first = await cron();
  ok(
    "el cron responde con el resumen",
    first.status === 200 && typeof first.body?.unread?.sent === "number",
    JSON.stringify(first.body),
  );
  const rows = await logRows(seller);
  ok(
    "avisa del mensaje que lleva 20 minutos sin leer",
    rows.length === 1 && rows[0].ref.startsWith(`${waiting}:`),
    JSON.stringify(rows),
  );
  ok("no avisa del que tiene 5 minutos", (await logRows(buyer)).length === 0);
  ok("ni del que ya se leyó", (await logRows(reader)).length === 0);

  // Otro mensaje sin leer dentro de la misma hora: no hay segundo email.
  await message(waiting, buyer, 16, "¿Hola?");
  const second = await cron();
  ok(
    "como mucho un email por hora",
    second.body?.unread?.sent === 0 && (await logRows(seller)).length === 1,
    JSON.stringify(second.body),
  );
  // Pasada la hora, el mensaje nuevo sí se avisa.
  await admin
    .from("notification_log")
    .update({ sent_at: new Date(Date.now() - 61 * MINUTE).toISOString() })
    .eq("id", rows[0].id);
  await cron();
  ok("pasada la hora, avisa del mensaje nuevo", (await logRows(seller)).length === 2);
  await admin
    .from("notification_log")
    .update({ sent_at: new Date(Date.now() - 61 * MINUTE).toISOString() })
    .eq("user_id", seller)
    .eq("kind", "unread_messages");
  const again = await cron();
  ok(
    "y no vuelve a avisar de lo ya avisado",
    again.body?.unread?.sent === 0 && (await logRows(seller)).length === 2,
    JSON.stringify(again.body),
  );
} catch (error) {
  crash(error);
} finally {
  if (users.length) {
    await admin
      .from("notification_log")
      .delete()
      .eq("kind", "unread_messages")
      .eq("channel", "email")
      .gte("sent_at", started)
      .not("user_id", "in", `(${users.join(",")})`);
  }
  if (conversations.length) await admin.from("conversations").delete().in("id", conversations);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
finish();
