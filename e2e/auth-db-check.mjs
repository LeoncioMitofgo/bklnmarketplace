// Prueba de extremo a extremo de la capa de datos de auth contra el proyecto Supabase dev.
// Uso: pnpm e2e auth-db-check [--keep]   (--keep deja el usuario de prueba para probar las páginas)
//      pnpm e2e auth-db-check --cleanup <username>
import { createHash, randomBytes } from "node:crypto";
import { createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !pub || !secret) throw new Error("Faltan variables en .env.local");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
const fresh = () => createClient(url, pub, opts);

if (process.argv[2] === "--cleanup") {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", process.argv[3])
    .single();
  if (data) {
    await admin.auth.admin.deleteUser(data.id);
    const { data: gone } = await admin
      .from("profiles")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    ok("borrar cuenta borra el perfil en cascada", gone === null);
  }
  finish();
}

const suffix = randomBytes(3).toString("hex");
const username = `prueba_${suffix}`;
const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
const email = `prueba+${suffix}@bklnmarketplace.com`;
const password = `Prueba-${randomBytes(6).toString("hex")}`;
let userId;

try {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: "Usuaria de Prueba", phone },
  });
  ok("crear usuario (trigger de registro)", !error, error?.message);
  userId = created?.user?.id;

  const { data: prof } = await admin.from("profiles").select("username").eq("id", userId).single();
  ok("perfil público creado", prof?.username === username);
  const { data: priv } = await admin
    .from("profile_private")
    .select("phone, email_verified_at, role")
    .eq("user_id", userId)
    .single();
  ok(
    "datos privados creados (rol user, email sin verificar)",
    priv?.phone === phone && priv?.role === "user" && priv?.email_verified_at === null,
  );

  const reserved = await admin.auth.admin.createUser({
    email: `r${suffix}@bklnmarketplace.com`,
    password,
    email_confirm: true,
    user_metadata: { username: "admin", display_name: "X", phone: "+240555000001" },
  });
  ok("nombre de usuario reservado rechazado", !!reserved.error);
  if (reserved.data?.user) await admin.auth.admin.deleteUser(reserved.data.user.id);

  const dup = await admin.auth.admin.createUser({
    email: `d${suffix}@bklnmarketplace.com`,
    password,
    email_confirm: true,
    user_metadata: { username: `otra_${suffix}`, display_name: "X", phone },
  });
  ok("teléfono duplicado rechazado", !!dup.error);
  if (dup.data?.user) await admin.auth.admin.deleteUser(dup.data.user.id);

  const national = phone.slice(4);
  for (const [label, id] of [
    ["usuario en mayúsculas", username.toUpperCase()],
    ["teléfono con espacios", national.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")],
    ["teléfono con 00240", `00240${national}`],
    ["email", email],
  ]) {
    const { data } = await admin.rpc("resolve_login_email", { p_identifier: id });
    ok(`resolver el email por ${label}`, data === email, String(data));
  }
  const { data: none } = await admin.rpc("resolve_login_email", { p_identifier: "no_existe_xyz" });
  ok("identificador inexistente → null", none === null);

  const login = fresh();
  const { data: signIn, error: signErr } = await login.auth.signInWithPassword({ email, password });
  ok("entrar con el email resuelto + contraseña", !!signIn?.session && !signErr, signErr?.message);

  const userClient = createClient(url, pub, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${signIn?.session?.access_token}` } },
  });
  const { data: ownPriv } = await userClient
    .from("profile_private")
    .select("phone")
    .eq("user_id", userId)
    .maybeSingle();
  ok("el usuario ve su propio teléfono", ownPriv?.phone === phone);
  const { data: anonPriv } = await fresh().from("profile_private").select("phone");
  ok("un anónimo no ve ningún teléfono", !anonPriv || anonPriv.length === 0);

  const { error: premErr } = await userClient
    .from("profiles")
    .update({ premium_until: "2099-01-01T00:00:00Z" })
    .eq("id", userId);
  ok("el usuario no puede darse Premium a sí mismo", !!premErr);
  const { error: bioErr } = await userClient
    .from("profiles")
    .update({ bio: "Hola" })
    .eq("id", userId);
  ok("el usuario sí puede editar su bio", !bioErr, bioErr?.message);

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await admin.from("email_verification_tokens").insert({
    token_hash: hash,
    user_id: userId,
    email,
    expires_at: new Date(Date.now() + 3600e3).toISOString(),
  });
  const { data: consumed } = await admin.rpc("consume_email_verification_token", {
    p_token_hash: hash,
  });
  ok("canjear el token de verificación", consumed === userId);
  const { data: again } = await admin.rpc("consume_email_verification_token", {
    p_token_hash: hash,
  });
  ok("el token no se puede usar dos veces", again === null);
  const { data: priv2 } = await admin
    .from("profile_private")
    .select("email_verified_at")
    .eq("user_id", userId)
    .single();
  ok("email marcado como verificado", !!priv2?.email_verified_at);
  const { error: anonRpc } = await fresh().rpc("consume_email_verification_token", {
    p_token_hash: "x",
  });
  ok("un anónimo no puede canjear tokens", !!anonRpc);

  const key = `test:${suffix}`;
  const results = [];
  for (let i = 0; i < 4; i++) {
    const { data } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: 3,
      p_window_seconds: 60,
    });
    results.push(data);
  }
  ok(
    "límite de intentos: 3 pasan, el 4.º no",
    JSON.stringify(results) === "[true,true,true,false]",
    JSON.stringify(results),
  );
  await admin.from("rate_limits").delete().eq("key", key);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  ok(
    "generar el enlace de recuperación",
    !!link?.properties?.hashed_token && !linkErr,
    linkErr?.message,
  );
  const { error: otpErr } = await fresh().auth.verifyOtp({
    type: "recovery",
    token_hash: link?.properties?.hashed_token,
  });
  ok("canjear el enlace de recuperación", !otpErr, otpErr?.message);

  console.log(`\nUSUARIO_DE_PRUEBA=${username}`);
} finally {
  if (!process.argv.includes("--keep") && userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}

finish();
