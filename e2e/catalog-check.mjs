// Prueba de extremo a extremo del catálogo público (fase 1.3) contra el proyecto dev y un servidor local.
// Uso: pnpm e2e catalog-check   (crea y borra sus propios usuarios y anuncio)
import { randomBytes } from "node:crypto";
import { BASE, crash, createClient, env, finish, ok } from "./lib.mjs";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts);
const anon = createClient(url, pub, opts);
const BUCKET = "listing-images";
const TINY_WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAAAAAAAAAAAA",
  "base64",
);

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

const letters = () =>
  Array.from(randomBytes(6), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const tag = `zq${letters()}`;
const users = [];

async function makeUser(label) {
  const suffix = letters();
  const email = `catalogo+${suffix}@bklnmarketplace.com`;
  const password = `Prueba-${randomBytes(6).toString("hex")}`;
  const phone = `+240555${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `cat_${suffix}`, display_name: label, phone },
  });
  if (error) throw error;
  users.push(data.user.id);
  await admin
    .from("profile_private")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", data.user.id);
  const client = createClient(url, pub, opts);
  const { data: login } = await client.auth.signInWithPassword({ email, password });
  return {
    id: data.user.id,
    username: `cat_${suffix}`,
    email,
    phone,
    client,
    cookie: sessionCookie(login.session),
  };
}

const page = async (path, cookie) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return { status: res.status, body: await res.text(), location: res.headers.get("location") };
};

try {
  const seller = await makeUser("Vendedora Catálogo");
  const buyer = await makeUser("Comprador Catálogo");

  const [{ data: cars }, { data: bata }, { data: draftCat }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", "coches").single(),
    admin.from("cities").select("id").eq("slug", "bata").single(),
    admin.from("categories").select("id").eq("slug", "moviles").single(),
  ]);

  const title = `Toyota Hilux ${tag} doble cabina`;
  const { data: listing, error: insertError } = await admin
    .from("listings")
    .insert({
      user_id: seller.id,
      category_id: cars.id,
      title,
      description: "Diésel, revisiones al día.\nSe puede ver en Bata.",
      price_xaf: 14500000,
      is_negotiable: true,
      condition: "used",
      city_id: bata.id,
      neighborhood: "Ela Nguema",
      attributes: {
        brand: "Toyota",
        model: "Hilux",
        year: 2018,
        mileage_km: 120000,
        fuel: "Diésel",
        furnished: false,
      },
      status: "active",
      first_published_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .select("id, code, updated_at")
    .single();
  if (insertError) throw insertError;

  const imageId = crypto.randomUUID();
  const base = `${seller.id}/${listing.id}/${imageId}`;
  for (const variant of ["l", "t"]) {
    await admin.storage
      .from(BUCKET)
      .upload(`${base}-${variant}.webp`, TINY_WEBP, { contentType: "image/webp" });
  }
  const { error: imageError } = await admin.from("listing_images").insert({
    id: imageId,
    listing_id: listing.id,
    storage_path: base,
    format: "webp",
    width: 1200,
    height: 900,
  });
  ok("foto de portada registrada", !imageError, imageError?.message);

  const { data: draft } = await admin
    .from("listings")
    .insert({ user_id: seller.id, category_id: draftCat.id, title: `Borrador ${tag}` })
    .select("id")
    .single();

  // ─── Base de datos ──────────────────────────────────────────────────────────
  const search = (args) => anon.rpc("search_listings", args);
  let r = await search({ p_query: tag });
  ok(
    "búsqueda por texto (visitante)",
    r.data?.length === 1 && r.data[0].code === listing.code,
    r.error?.message,
  );
  ok(
    "la tarjeta trae portada e insignia",
    r.data?.[0]?.cover_path === base && r.data?.[0]?.seller_is_premium === false,
  );
  r = await search({ p_query: `${tag} hilux toyota` });
  ok("búsqueda con varias palabras", r.data?.length === 1);
  r = await search({
    p_query: "toyota hilux doble cabina",
    p_category_id: cars.id,
    p_city_id: bata.id,
  });
  ok(
    "búsqueda con categoría y ciudad",
    r.data?.some((x) => x.code === listing.code),
  );
  r = await search({ p_query: tag, p_attributes: { brand: "Kia" } });
  ok("filtro de atributo que no coincide → nada", r.data?.length === 0);
  r = await search({ p_query: tag, p_ranges: { year: [2015, 2020], mileage_km: [null, 150000] } });
  ok("rangos de año y kilometraje", r.data?.length === 1);
  r = await search({ p_query: tag, p_ranges: { year: [2019, null] } });
  ok("rango de año que deja fuera", r.data?.length === 0);
  r = await search({ p_query: tag, p_condition: "new" });
  ok("filtro de estado nuevo → nada", r.data?.length === 0);
  r = await search({ p_query: `Borrador ${tag}` });
  ok(
    "los borradores no salen en la búsqueda",
    !r.data?.some((x) => x.title?.startsWith("Borrador")),
  );

  const fav = await buyer.client.from("favorites").insert({ listing_id: listing.id });
  ok("el comprador guarda el favorito", !fav.error, fav.error?.message);
  const favDup = await buyer.client.from("favorites").insert({ listing_id: listing.id });
  ok(
    "guardar dos veces → clave duplicada (23505)",
    favDup.error?.code === "23505",
    favDup.error?.code,
  );
  const favDraft = await buyer.client.from("favorites").insert({ listing_id: draft.id });
  ok("no se puede guardar un borrador ajeno", Boolean(favDraft.error));
  const favOther = await buyer.client
    .from("favorites")
    .insert({ listing_id: listing.id, user_id: seller.id });
  ok("no se puede guardar a nombre de otro", Boolean(favOther.error));
  const sellerSees = await seller.client.from("favorites").select("*");
  ok("cada uno solo ve sus favoritos", sellerSees.data?.length === 0);
  const anonFav = await anon.from("favorites").insert({ listing_id: listing.id });
  ok("un visitante no puede guardar favoritos", Boolean(anonFav.error));

  await buyer.client.rpc("register_listing_view", { p_listing_id: listing.id });
  await seller.client.rpc("register_listing_view", { p_listing_id: listing.id });
  await anon.rpc("register_listing_view", { p_listing_id: listing.id });
  let { data: viewed } = await admin
    .from("listings")
    .select("view_count, updated_at")
    .eq("id", listing.id)
    .single();
  ok(
    "vistas: cuentan comprador y visitante, no la vendedora",
    viewed.view_count === 2,
    String(viewed.view_count),
  );
  ok("una vista no cambia updated_at", viewed.updated_at === listing.updated_at);

  let mine = await buyer.client.rpc("my_favorites", {});
  ok(
    "my_favorites: activo con título y portada",
    mine.data?.[0]?.availability === "active" &&
      mine.data[0].title === title &&
      mine.data[0].cover_path === base,
  );

  const paused = await seller.client.rpc("pause_listing", { p_listing_id: listing.id });
  ok("la vendedora pausa el anuncio", !paused.error, paused.error?.message);
  mine = await buyer.client.rpc("my_favorites", {});
  ok(
    "my_favorites: pausado, con su título",
    mine.data?.[0]?.availability === "paused" && mine.data[0].title === title,
  );
  r = await search({ p_query: tag });
  ok("un pausado no sale en la búsqueda", r.data?.length === 0);
  await buyer.client.rpc("register_listing_view", { p_listing_id: listing.id });
  ({ data: viewed } = await admin
    .from("listings")
    .select("view_count")
    .eq("id", listing.id)
    .single());
  ok("un pausado no suma vistas", viewed.view_count === 2);

  await seller.client.rpc("reactivate_listing", { p_listing_id: listing.id });
  await seller.client.rpc("mark_listing_sold", { p_listing_id: listing.id });
  mine = await buyer.client.rpc("my_favorites", {});
  ok("my_favorites: vendido", mine.data?.[0]?.availability === "sold");
  const soldCard = await anon
    .from("listing_cards")
    .select("status")
    .eq("id", listing.id)
    .maybeSingle();
  ok("un vendido reciente sigue visible como vendido", soldCard.data?.status === "sold");

  await admin
    .from("listings")
    .update({ status: "blocked", moderation_reason: "Prueba" })
    .eq("id", listing.id);
  mine = await buyer.client.rpc("my_favorites", {});
  ok(
    "my_favorites: bloqueado sin contenido",
    mine.data?.[0]?.availability === "unavailable" &&
      mine.data[0].title === null &&
      mine.data[0].cover_path === null,
  );
  await admin
    .from("listings")
    .update({ status: "active", moderation_reason: null, sold_at: null })
    .eq("id", listing.id);

  // ─── Páginas ────────────────────────────────────────────────────────────────
  const path = `/anuncio/toyota-hilux-${tag}-doble-cabina-bata-${listing.code}`;
  let p = await page(path);
  ok("ficha pública (visitante)", p.status === 200 && p.body.includes(title), String(p.status));
  ok("precio y negociable", p.body.includes("14.500.000 FCFA") && p.body.includes("Negociable"));
  ok(
    "atributos: año sin separador y km con separador",
    p.body.includes(">2018<") && p.body.includes("120.000 km"),
  );
  ok("atributo sí/no en falso → «No»", !p.body.includes("Amueblado") || p.body.includes(">No<"));
  ok("consejos de seguridad", p.body.includes("Compra con seguridad"));
  ok(
    "Open Graph con la foto grande",
    p.body.includes('property="og:image"') && p.body.includes(`${base}-l.webp`),
  );
  ok(
    "canonical",
    p.body.includes(`rel="canonical" href="http://localhost:3000${path}"`) ||
      p.body.includes(`${path}"`),
  );
  ok(
    "JSON-LD Product en XAF",
    p.body.includes('"@type":"Product"') && p.body.includes('"priceCurrency":"XAF"'),
  );
  ok(
    "ni el teléfono ni el email del vendedor en el HTML",
    !p.body.includes(seller.phone.slice(4)) && !p.body.includes(seller.email),
  );
  ok("enlace al perfil del vendedor", p.body.includes(`/u/${seller.username}`));
  ok("sin sesión: botón para guardar", p.body.includes("Guardar en favoritos"));
  ok("noindex hasta el lanzamiento", p.body.includes('name="robots" content="noindex, nofollow"'));

  p = await page(path, buyer.cookie);
  ok(
    "con favorito guardado: botón «Quitar de favoritos»",
    p.body.includes("Quitar de favoritos") && p.body.includes('aria-pressed="true"'),
  );

  p = await page(`/anuncio/otro-titulo-${listing.code}`);
  ok("slug antiguo → redirección a la URL canónica", p.body.includes(`url=${path}`));
  p = await page(`/anuncio/no-existe-abcdefgh`);
  ok("código inexistente → no existe", p.body.includes("Esta página no existe"));

  p = await page(`/buscar?q=${tag}`);
  ok("/buscar encuentra el anuncio", p.body.includes(title) && p.body.includes("1 anuncio"));
  p = await page(`/categoria/coches?q=${tag}&marca=Toyota&anio_min=2015&ciudad=bata`);
  ok("/categoria con filtros: lo encuentra", p.body.includes(title));
  ok(
    "chips de filtros activos",
    p.body.includes("Quitar filtro: Toyota") && p.body.includes("Quitar filtro: Bata"),
  );
  p = await page(`/categoria/coches?q=${tag}&marca=Kia`);
  ok(
    "/categoria con un filtro que no coincide → vacío",
    !p.body.includes(title) && p.body.includes("Ningún anuncio"),
  );
  p = await page(`/buscar?categoria=coches&orden=precio-desc`);
  ok(
    "orden por precio de mayor a menor",
    p.body.includes("Precio más alto") &&
      p.body.indexOf("30.000.000 FCFA") < p.body.indexOf("14.500.000 FCFA") &&
      p.body.indexOf("30.000.000 FCFA") > 0,
    "¿sigue el anuncio de 30.000.000 de julio_nkulu?",
  );
  p = await page(`/buscar?categoria=coches&orden=precio-asc`);
  ok(
    "orden por precio de menor a mayor",
    p.body.indexOf("14.500.000 FCFA") < p.body.indexOf("30.000.000 FCFA"),
  );

  p = await page(`/u/${seller.username}`);
  ok("perfil con su anuncio en venta", p.body.includes(title) && p.body.includes("En venta (1)"));

  p = await page("/favoritos", buyer.cookie);
  ok("/favoritos con sesión", p.body.includes(title), String(p.status));
  p = await page("/favoritos");
  // Las pantallas con sesión redirigen a entrar en el proxy (D-054).
  ok(
    "/favoritos sin sesión → entrar y volver",
    p.status === 307 && decodeURIComponent(p.location ?? "").endsWith("/entrar?next=/favoritos"),
    `${p.status} ${p.location}`,
  );

  p = await page("/");
  ok(
    "inicio con categorías y recientes",
    p.body.includes("Categorías") &&
      p.body.includes("Recientes") &&
      p.body.includes("/categoria/vehiculos"),
  );
  p = await page("/robots.txt");
  ok("robots.txt bloquea todo hasta el lanzamiento", p.body.includes("Disallow: /"));

  // El HTML de las páginas públicas no lleva los textos de registro ni del asistente.
  p = await page("/buscar");
  ok(
    "/buscar sin los textos de auth ni del asistente",
    !p.body.includes("Crea tu cuenta") && !p.body.includes("Añade fotos"),
  );
} catch (error) {
  crash(error);
} finally {
  for (const id of users) {
    const { data: files } = await admin.storage.from(BUCKET).list(id, { limit: 100 });
    for (const dir of files ?? []) {
      const { data: inner } = await admin.storage.from(BUCKET).list(`${id}/${dir.name}`);
      if (inner?.length)
        await admin.storage.from(BUCKET).remove(inner.map((f) => `${id}/${dir.name}/${f.name}`));
    }
    await admin.auth.admin.deleteUser(id);
  }
}

finish();
