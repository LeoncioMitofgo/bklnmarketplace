import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { listingPath } from "@/lib/listings/paths";
import { getSitemapListings } from "@/lib/listings/public";
import { siteUrl } from "@/lib/site";

// Sitemap (ALCANCE §7): inicio, categorías, anuncios activos y perfiles de quien tiene anuncios.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [catalog, listings] = await Promise.all([getCatalog(), getSitemapListings()]);

  const cityName = (id: number | null) => catalog.cities.find((c) => c.id === id)?.name ?? null;
  const sellers = new Set(listings.flatMap((l) => (l.seller ? [l.seller.username] : [])));

  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    ...catalog.categories.map((category) => ({
      url: `${base}/categoria/${category.slug}`,
      changeFrequency: "hourly" as const,
      priority: category.parent_id === null ? 0.8 : 0.7,
    })),
    ...listings.map((listing) => ({
      url: `${base}${listingPath(listing.code, listing.title, cityName(listing.city_id))}`,
      lastModified: listing.updated_at,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...[...sellers].map((username) => ({
      url: `${base}/u/${username}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
