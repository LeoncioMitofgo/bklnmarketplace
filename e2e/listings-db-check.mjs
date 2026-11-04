// Prueba de extremo a extremo de la capa de datos de anuncios contra el proyecto Supabase dev.
// Uso: pnpm e2e listings-db-check   (crea y borra su propio usuario de prueba)
import { randomBytes } from "node:crypto";
import { createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const anon = () => createClient(url, pub, opts);
const BUCKET = "listing-images";

const errMsg = (r) => r?.error?.message;

// WebP de 1×1 píxel válido.
const TINY_WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAAAAAAAAAAAA",
  "base64",
);

const suffix = randomBytes(3).toString("hex");
const email = `anuncios+${suffix}@bklnmarketplace.com`;
const password = `Prueba-${randomBytes(6).toString("hex")}`;
let userId;
const uploaded = [];
const originalNormalMax = 10;

try {
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `anuncios_${suffix}`,
      display_name: "Vendedora de Prueba",
      phone: `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    },
  });
  userId = created.user.id;
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", userId);

  const login = anon();
  const { data: session } = await login.auth.signInWithPassword({ email, password });
  const user = createClient(url, pub, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
  });

  const { data: cats } = await admin.from("categories").select("id, slug, parent_id");
  const cat = (slug) => cats.find((c) => c.slug === slug);
  const { data: malabo } = await admin.from("cities").select("id").eq("slug", "malabo").single();

  // ── Borrador y permisos ──
  const draft = await user
    .from("listings")
    .insert({ is_negotiable: false })
    .select("id, code, user_id, status")
    .single();
  ok(
    "crear borrador",
    !draft.error && draft.data.status === "draft" && draft.data.user_id === userId,
    errMsg(draft),
  );
  ok("código público de 8 caracteres", /^[a-z2-9]{8}$/.test(draft.data?.code ?? ""));
  const listingId = draft.data.id;

  const direct = await user.from("listings").insert({ status: "active" }).select("id");
  ok("no se puede crear un anuncio ya activo", !!direct.error);
  const hack = await user
    .from("listings")
    .update({ status: "active" })
    .eq("id", listingId)
    .select("id");
  ok("no se puede cambiar el estado sin pasar por la RPC", !!hack.error);
  const hackExpiry = await user
    .from("listings")
    .update({ expires_at: "2099-01-01" })
    .eq("id", listingId)
    .select("id");
  ok("no se puede tocar la fecha de caducidad", !!hackExpiry.error);

  const notLeaf = await user
    .from("listings")
    .update({ category_id: cat("vehiculos").id })
    .eq("id", listingId);
  ok(
    "rechaza una categoría principal (no subcategoría)",
    errMsg(notLeaf) === "listing_category_not_leaf",
    errMsg(notLeaf),
  );
  await user
    .from("listings")
    .update({ category_id: cat("moviles").id })
    .eq("id", listingId);
  const { data: withRoot } = await admin
    .from("listings")
    .select("root_category_id")
    .eq("id", listingId)
    .single();
  ok("deriva la categoría principal", withRoot.root_category_id === cat("moviles-tablets").id);

  const incomplete = await user.rpc("publish_listing", { p_listing_id: listingId });
  ok(
    "publicar sin datos → listing_incomplete",
    errMsg(incomplete) === "listing_incomplete",
    errMsg(incomplete),
  );

  const details = await user
    .from("listings")
    .update({
      title: "iPhone 13 128 GB como nuevo",
      description: "Batería al 91 %. Con caja.",
      price_xaf: 350000,
      condition: "used",
      city_id: malabo.id,
      attributes: { brand: "Apple" },
    })
    .eq("id", listingId);
  ok("guardar los detalles del borrador", !details.error, errMsg(details));
  const noPhoto = await user.rpc("publish_listing", { p_listing_id: listingId });
  ok(
    "publicar sin fotos → listing_photo_required",
    errMsg(noPhoto) === "listing_photo_required",
    errMsg(noPhoto),
  );

  // ── Fotos: subida firmada real ──
  const imageId = crypto.randomUUID();
  const base = `${userId}/${listingId}/${imageId}`;
  for (const variant of ["l", "t"]) {
    const path = `${base}-${variant}.webp`;
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    const put = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: {
        "content-type": "image/webp",
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: TINY_WEBP,
    });
    ok(
      `subir la variante ${variant} a la URL firmada`,
      put.ok,
      `${put.status} ${await put.text()}`,
    );
    uploaded.push(path);
  }
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${base}-t.webp`;
  const served = await fetch(publicUrl);
  ok(
    "la miniatura se sirve públicamente",
    served.ok && served.headers.get("content-type") === "image/webp",
  );

  const { data: pngSigned } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(`${base}-x.png`);
  const png = await fetch(pngSigned.signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: TINY_WEBP,
  });
  ok("el bucket rechaza tipos no permitidos (PNG)", !png.ok);

  const badPath = await user.from("listing_images").insert({
    id: crypto.randomUUID(),
    listing_id: listingId,
    storage_path: "otro/usuario/x",
    format: "webp",
    width: 1,
    height: 1,
  });
  ok(
    "rechaza rutas de foto que no son del dueño",
    errMsg(badPath) === "listing_image_bad_path",
    errMsg(badPath),
  );

  const image = await user
    .from("listing_images")
    .insert({
      id: imageId,
      listing_id: listingId,
      storage_path: base,
      format: "webp",
      width: 1,
      height: 1,
    })
    .select("position")
    .single();
  ok(
    "registrar la foto (posición 0 = portada)",
    !image.error && image.data.position === 0,
    errMsg(image),
  );

  const anonDraftImages = await anon()
    .from("listing_images")
    .select("id")
    .eq("listing_id", listingId);
  ok("un anónimo no ve las fotos de un borrador", anonDraftImages.data?.length === 0);

  // ── Publicar ──
  const published = await user.rpc("publish_listing", { p_listing_id: listingId });
  const { data: active } = await admin
    .from("listings")
    .select("status, expires_at, published_at")
    .eq("id", listingId)
    .single();
  // Desde la fecha de publicación: el reloj de este equipo y el de la base de datos no coinciden.
  const days = (Date.parse(active.expires_at) - Date.parse(active.published_at)) / 86400000;
  ok("publicar", !published.error && active.status === "active", errMsg(published));
  ok(
    "caduca a los 30 días (plan Normal)",
    days === 30 && Date.now() - Date.parse(active.published_at) < 60000,
    `${days} días · ${active.published_at} → ${active.expires_at}`,
  );
  const anonActive = await anon().from("listings").select("id").eq("id", listingId);
  ok("un anónimo ve el anuncio activo", anonActive.data?.length === 1);

  // ── Límite de fotos (Normal: 6) ──
  const extra = [];
  let limitError = null;
  for (let i = 0; i < 6; i++) {
    const id = crypto.randomUUID();
    const r = await user.from("listing_images").insert({
      id,
      listing_id: listingId,
      storage_path: `${userId}/${listingId}/${id}`,
      format: "webp",
      width: 1,
      height: 1,
    });
    if (r.error) {
      limitError = r.error.message;
      break;
    }
    extra.push(id);
  }
  ok(
    "límite de fotos del plan: la 7.ª se rechaza",
    extra.length === 5 && limitError === "listing_photo_limit",
    `${extra.length} ${limitError}`,
  );
  await admin.from("listing_images").delete().in("id", extra);

  const cover = await user.rpc("set_listing_cover", { p_image_id: imageId });
  ok("poner de portada (la que ya lo es)", !cover.error, errMsg(cover));
  const lastPhoto = await user.from("listing_images").delete().eq("id", imageId);
  ok(
    "un anuncio publicado no se queda sin fotos",
    errMsg(lastPhoto) === "listing_photo_required",
    errMsg(lastPhoto),
  );

  const banned = await user
    .from("listings")
    .update({ title: "Vendo cocaína barata" })
    .eq("id", listingId);
  ok(
    "editar con un término prohibido se rechaza",
    errMsg(banned) === "listing_banned_term",
    errMsg(banned),
  );

  // ── Estados ──
  const tooEarly = await user.rpc("renew_listing", { p_listing_id: listingId });
  ok(
    "no se puede renovar con 30 días por delante",
    errMsg(tooEarly) === "listing_renew_not_allowed",
    errMsg(tooEarly),
  );

  const statusOf = async () =>
    (await admin.from("listings").select("status").eq("id", listingId).single()).data.status;
  await user.rpc("pause_listing", { p_listing_id: listingId });
  ok("pausar", (await statusOf()) === "paused");
  ok(
    "un anónimo no ve un anuncio pausado",
    (await anon().from("listings").select("id").eq("id", listingId)).data?.length === 0,
  );
  await user.rpc("reactivate_listing", { p_listing_id: listingId });
  ok("reactivar", (await statusOf()) === "active");
  await user.rpc("mark_listing_sold", { p_listing_id: listingId });
  ok("marcar vendido", (await statusOf()) === "sold");
  ok(
    "un anónimo ve los vendidos recientes",
    (await anon().from("listings").select("id").eq("id", listingId)).data?.length === 1,
  );
  await user.rpc("reactivate_listing", { p_listing_id: listingId });
  ok("deshacer vendido", (await statusOf()) === "active");

  await admin
    .from("listings")
    .update({ expires_at: new Date(Date.now() - 60000).toISOString() })
    .eq("id", listingId);
  const { data: expiredCount } = await admin.rpc("expire_listings");
  ok(
    "la tarea de caducidad caduca el anuncio",
    expiredCount >= 1 && (await statusOf()) === "expired",
  );
  const renew = await user.rpc("renew_listing", { p_listing_id: listingId });
  ok("renovar un caducado", !renew.error && (await statusOf()) === "active", errMsg(renew));

  // ── Duplicados y límite de anuncios ──
  const second = await user.from("listings").insert({ is_negotiable: false }).select("id").single();
  const secondId = second.data.id;
  await user
    .from("listings")
    .update({
      category_id: cat("moviles").id,
      title: "iPhone 13 128 GB como nuevo!",
      description: "Igual que el otro.",
      price_xaf: 340000,
      condition: "used",
      city_id: malabo.id,
    })
    .eq("id", secondId);
  const secondImage = crypto.randomUUID();
  await user.from("listing_images").insert({
    id: secondImage,
    listing_id: secondId,
    storage_path: `${userId}/${secondId}/${secondImage}`,
    format: "webp",
    width: 1,
    height: 1,
  });
  const dup = await user.rpc("publish_listing", { p_listing_id: secondId });
  ok("detecta un anuncio duplicado", errMsg(dup) === "listing_duplicate", errMsg(dup));

  await user
    .from("listings")
    .update({ title: "Samsung Galaxy A54 nuevo en caja" })
    .eq("id", secondId);
  await admin.from("plans").update({ max_active_listings: 1 }).eq("id", "normal");
  const limit = await user.rpc("publish_listing", { p_listing_id: secondId });
  ok(
    "respeta el límite de anuncios activos del plan",
    errMsg(limit) === "listing_limit_reached",
    errMsg(limit),
  );
  await admin.from("plans").update({ max_active_listings: originalNormalMax }).eq("id", "normal");

  const del = await user.rpc("delete_listing", { p_listing_id: secondId });
  const ownList = await user.from("listings").select("id").eq("id", secondId);
  ok(
    "eliminar (borrado lógico, deja de verse)",
    !del.error && ownList.data?.length === 0,
    errMsg(del),
  );

  const other = await anon().rpc("pause_listing", { p_listing_id: listingId });
  ok("un anónimo no puede ejecutar las RPC de estado", !!other.error);
} finally {
  await admin.from("plans").update({ max_active_listings: originalNormalMax }).eq("id", "normal");
  if (uploaded.length) await admin.storage.from(BUCKET).remove(uploaded);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

finish();
