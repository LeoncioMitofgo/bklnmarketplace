// Comprueba páginas con sesión contra un servidor local (next start) y el proyecto dev.
// Uso: pnpm e2e listings-pages-check
import { randomBytes } from "node:crypto";
import { BASE, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);

/** Cookie de sesión con el formato de @supabase/ssr ("base64-" + JSON, troceada si es larga). */
function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const CHUNK = 3180;
  if (value.length <= CHUNK) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++)
    parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return parts.join("; ");
}

const suffix = randomBytes(3).toString("hex");
const email = `paginas+${suffix}@bklnmarketplace.com`;
const password = `Prueba-${randomBytes(6).toString("hex")}`;
let userId;

try {
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `paginas_${suffix}`,
      display_name: "Probadora de Páginas",
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  userId = created.user.id;
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", userId);

  const { data: login } = await createClient(
    url,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    opts,
  ).auth.signInWithPassword({ email, password });
  const cookie = sessionCookie(login.session);
  const get = async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    return { status: res.status, body: await res.text() };
  };

  // Un borrador y un anuncio publicado.
  const { data: cats } = await admin.from("categories").select("id, slug");
  const { data: malabo } = await admin.from("cities").select("id").eq("slug", "malabo").single();
  const { data: draft } = await admin
    .from("listings")
    .insert({ user_id: userId })
    .select("id")
    .single();
  const { data: listing } = await admin
    .from("listings")
    .insert({
      user_id: userId,
      category_id: cats.find((c) => c.slug === "casas-pisos-alquiler").id,
      title: "Piso de 3 habitaciones en Caracolas",
      description: "Amueblado, con agua y luz.",
      price_xaf: 450000,
      city_id: malabo.id,
      neighborhood: "Caracolas",
      attributes: { property_type: "Piso", bedrooms: 3 },
      status: "active",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .select("id")
    .single();

  const mine = await get("/mis-anuncios");
  ok(
    "/mis-anuncios con sesión",
    mine.status === 200 && mine.body.includes("Mis anuncios"),
    String(mine.status),
  );
  ok("muestra el anuncio activo", mine.body.includes("Piso de 3 habitaciones en Caracolas"));
  ok("precio de alquiler con /mes", mine.body.includes("450.000 FCFA/mes"));
  ok("uso del plan: 1 de 10", mine.body.includes("1 de 10 anuncios activos"));
  ok(
    "acciones de un activo (Pausar, Vendido)",
    mine.body.includes("Pausar") && mine.body.includes("Vendido"),
  );

  const drafts = await get("/mis-anuncios?estado=borradores");
  ok(
    "pestaña de borradores",
    drafts.body.includes("Borrador sin publicar") && drafts.body.includes("Continuar"),
  );

  const editor = await get(`/publicar/${listing.id}`);
  ok(
    "editor de un anuncio publicado (empieza en Revisar)",
    editor.status === 200 &&
      editor.body.includes("Editar anuncio") &&
      editor.body.includes("Revisa tu anuncio"),
    String(editor.status),
  );
  const draftEditor = await get(`/publicar/${draft.id}`);
  ok(
    "editor de un borrador (empieza en Fotos)",
    draftEditor.body.includes("Publicar anuncio") && draftEditor.body.includes("Añade fotos"),
  );

  const start = await get("/publicar");
  ok(
    "/publicar ofrece continuar el borrador",
    start.body.includes("Tienes anuncios sin terminar") &&
      start.body.includes("Empezar un anuncio nuevo"),
  );

  const foreign = await get("/publicar/00000000-0000-4000-8000-000000000000");
  ok(
    "el editor de un anuncio ajeno o inexistente → no existe",
    foreign.body.includes("Esta página no existe"),
  );

  const account = await get("/cuenta");
  ok(
    "/cuenta enlaza a Mis anuncios",
    account.body.includes("Mis anuncios") && account.body.includes("Probadora de Páginas"),
  );
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

finish();
