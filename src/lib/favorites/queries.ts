import "server-only";
import { createClient } from "@/lib/supabase/server";

// Favoritos del usuario de la sesión (RLS: cada uno ve los suyos). Usar dentro de <Suspense>.

export async function isFavorite(listingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("favorites")
    .select("listing_id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  return (count ?? 0) > 0;
}

export type FavoriteAvailability = "active" | "sold" | "paused" | "expired" | "unavailable";

export async function getMyFavorites() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_favorites", { p_limit: 200 });
  if (error) throw new Error(`my_favorites: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    availability: row.availability as FavoriteAvailability,
  }));
}
