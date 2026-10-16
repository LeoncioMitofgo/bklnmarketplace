import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import { LISTINGS_TAG, listingTag } from "./tags";

// Consultas públicas (rol anon, RLS: activos y vendidos recientes), cacheadas por etiquetas.
// Cualquier cambio de un anuncio invalida LISTINGS_TAG (actions.ts). Lo que caduca pg_cron
// se refleja al revalidar ("minutes": como mucho, 1 minuto después).

export type ListingCardData = {
  id: string;
  code: string;
  status: "active" | "sold";
  title: string | null;
  price_xaf: number | null;
  is_negotiable: boolean;
  condition: "new" | "used" | null;
  category_id: number | null;
  city_id: number | null;
  neighborhood: string | null;
  published_at: string | null;
  sold_at: string | null;
  cover_path: string | null;
  cover_format: string | null;
  seller_is_premium: boolean;
};

const CARD_COLUMNS =
  "id, code, status, title, price_xaf, is_negotiable, condition, category_id, city_id, neighborhood, published_at, sold_at, cover_path, cover_format, seller_is_premium";

// Las columnas de una vista llegan como opcionales en los tipos generados.
const asCards = (rows: unknown) => (rows ?? []) as ListingCardData[];

export async function getRecentListings(limit: number): Promise<ListingCardData[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("listing_cards")
    .select(CARD_COLUMNS)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recent_listings: ${error.message}`);
  return asCards(data);
}

/** Destacados: anuncios de vendedores Premium, en orden aleatorio que cambia al revalidar (ALCANCE §4.1). */
export async function getFeaturedListings(limit: number): Promise<ListingCardData[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("listing_cards")
    .select(CARD_COLUMNS)
    .eq("status", "active")
    .eq("seller_is_premium", true)
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`featured_listings: ${error.message}`);

  const cards = asCards(data);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, limit);
}

export type SearchArgs = Database["public"]["Functions"]["search_listings"]["Args"];

export async function searchListings(args: SearchArgs) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient().rpc("search_listings", args);
  if (error) throw new Error(`search_listings: ${error.message}`);
  const rows = data ?? [];
  return {
    total: rows[0]?.total_count ?? 0,
    cards: rows.map(({ total_count: _, ...row }) => ({
      ...row,
      status: "active",
      sold_at: null,
    })) as ListingCardData[],
  };
}

export type PublicListing = NonNullable<Awaited<ReturnType<typeof getPublicListing>>>;

/** Ficha por código, con fotos y vendedor. Null si no existe o no es visible. */
export async function getPublicListing(code: string) {
  "use cache";
  cacheTag(LISTINGS_TAG, listingTag(code));
  cacheLife("minutes");

  const supabase = createPublicClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select(
      "id, code, user_id, status, title, description, price_xaf, is_negotiable, condition, category_id, city_id, neighborhood, attributes, view_count, published_at, sold_at, updated_at, listing_images(storage_path, format, width, height, position), seller:profiles!listings_user_id_fkey(username, display_name, created_at, premium_until, response_time_minutes, city:cities(name))",
    )
    .eq("code", code)
    .in("status", ["active", "sold"])
    .maybeSingle();
  if (error) throw new Error(`public_listing: ${error.message}`);
  if (!listing?.seller) return null;

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", listing.user_id)
    .eq("status", "active");

  const { listing_images, seller, ...rest } = listing;
  return {
    ...rest,
    status: rest.status as "active" | "sold",
    attributes: rest.attributes as Record<string, string | number | boolean>,
    images: [...listing_images].sort((a, b) => a.position - b.position),
    seller: { ...seller, activeListings: count ?? 0 },
  };
}

export async function getSimilarListings(
  categoryId: number,
  excludeId: string,
  limit: number,
): Promise<ListingCardData[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("listing_cards")
    .select(CARD_COLUMNS)
    .eq("status", "active")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`similar_listings: ${error.message}`);
  return asCards(data);
}

/** Catálogo del perfil: activos (hasta `limit`) y vendidos de los últimos 30 días. */
export async function getProfileListings(userId: string, limit: number) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  const [active, sold] = await Promise.all([
    supabase
      .from("listing_cards")
      .select(CARD_COLUMNS, { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(limit),
    supabase
      .from("listing_cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "sold")
      .order("sold_at", { ascending: false })
      .limit(12),
  ]);
  if (active.error || sold.error) {
    throw new Error(`profile_listings: ${active.error?.message ?? sold.error?.message}`);
  }
  return { active: asCards(active.data), activeTotal: active.count ?? 0, sold: asCards(sold.data) };
}

/** Anuncios activos y vendedores con anuncios, para el sitemap. */
export async function getSitemapListings() {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("listings")
    .select("code, title, city_id, updated_at, seller:profiles!listings_user_id_fkey(username)")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`sitemap_listings: ${error.message}`);
  return data;
}
