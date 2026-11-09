import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { listingPath } from "@/lib/listings/paths";
import { getSitemapListings } from "@/lib/listings/public";
import { isIndexable } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getSitemapStores } from "@/lib/stores/public";

// Sitemap (ALCANCE §7): inicio, la lista de categorías, cada categoría, anuncios activos, tiendas Premium y perfiles de quien
// tiene anuncios. Antes del lanzamiento, solo las tiendas reales y sus anuncios (D-081).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [catalog, allListings, allStores] = await Promise.all([
    getCatalog(),
    getSitemapListings(),
    getSitemapStores(),
  ]);
  const launched = isIndexable();
  const stores = launched ? allStores : allStores.filter((store) => !store.isDemo);
  const storeOwners = new Set(stores.map((store) => store.user_id));
  const listings = launched
    ? allListings
    : allListings.filter((listing) => storeOwners.has(listing.user_id));

  const cityName = (id: number | null) => catalog.cities.find((c) => c.id === id)?.name ?? null;
  const sellers = new Set(listings.flatMap((l) => (l.seller ? [l.seller.username] : [])));

  const listingEntries = listings.map((listing) => ({
    url: `${base}${listingPath(listing.code, listing.title, cityName(listing.city_id))}`,
    lastModified: listing.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  const storeEntries = stores.map((store) => ({
    url: `${base}/t/${store.slug}`,
    lastModified: store.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  if (!launched) return [...storeEntries, ...listingEntries];

  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/categorias`, changeFrequency: "weekly", priority: 0.8 },
    ...catalog.categories.map((category) => ({
      url: `${base}/categoria/${category.slug}`,
      changeFrequency: "hourly" as const,
      priority: category.parent_id === null ? 0.8 : 0.7,
    })),
    ...listingEntries,
    ...storeEntries,
    ...[...sellers].map((username) => ({
      url: `${base}/u/${username}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    { url: `${base}/premium`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
