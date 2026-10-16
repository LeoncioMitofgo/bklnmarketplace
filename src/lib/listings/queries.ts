import "server-only";
import { createClient } from "@/lib/supabase/server";

// Consultas con la sesión del usuario (RLS): solo devuelven lo suyo. Usar dentro de <Suspense>.

export type ListingStatus =
  | "draft"
  | "active"
  | "paused"
  | "sold"
  | "expired"
  | "under_review"
  | "blocked"
  | "deleted";

export type EditableImage = {
  id: string;
  storage_path: string;
  format: string;
  width: number;
  height: number;
  position: number;
};

export type EditableListing = {
  id: string;
  code: string;
  status: ListingStatus;
  category_id: number | null;
  city_id: number | null;
  neighborhood: string | null;
  title: string | null;
  description: string | null;
  price_xaf: number | null;
  is_negotiable: boolean;
  condition: "new" | "used" | null;
  attributes: Record<string, string | number | boolean>;
  updated_at: string;
};

const EDITABLE_COLUMNS =
  "id, code, status, category_id, city_id, neighborhood, title, description, price_xaf, is_negotiable, condition, attributes, updated_at";

export async function getEditableListing(listingId: string, userId: string) {
  const supabase = await createClient();
  const [listing, images] = await Promise.all([
    supabase
      .from("listings")
      .select(EDITABLE_COLUMNS)
      .eq("id", listingId)
      .eq("user_id", userId)
      .in("status", ["draft", "active", "paused", "sold", "expired"])
      .maybeSingle(),
    supabase
      .from("listing_images")
      .select("id, storage_path, format, width, height, position")
      .eq("listing_id", listingId)
      .order("position"),
  ]);
  if (!listing.data) return null;
  return {
    listing: listing.data as EditableListing,
    images: (images.data ?? []) as EditableImage[],
  };
}

export type MyListing = {
  id: string;
  code: string;
  status: ListingStatus;
  title: string | null;
  price_xaf: number | null;
  category_id: number | null;
  city_id: number | null;
  expires_at: string | null;
  moderation_reason: string | null;
  updated_at: string;
  cover: { storage_path: string; format: string } | null;
};

/** Anuncios del usuario (máximo 200 activos con Premium + borradores: sin paginar por ahora). */
export async function getMyListings(userId: string): Promise<MyListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, code, status, title, price_xaf, category_id, city_id, expires_at, moderation_reason, updated_at, listing_images(storage_path, format, position)",
    )
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("position", { referencedTable: "listing_images", ascending: true })
    .limit(1, { referencedTable: "listing_images" })
    .order("updated_at", { ascending: false })
    .limit(300);

  return (data ?? []).map(({ listing_images, ...listing }) => ({
    ...(listing as Omit<MyListing, "cover">),
    cover: listing_images[0] ?? null,
  }));
}

export async function getPlanUsage(userId: string) {
  const supabase = await createClient();
  const [plan, active, priv] = await Promise.all([
    supabase.rpc("current_plan", { p_user_id: userId }),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("profile_private").select("email_verified_at").eq("user_id", userId).single(),
  ]);
  return {
    planId: plan.data?.id ?? "normal",
    maxActive: plan.data?.max_active_listings ?? 0,
    maxPhotos: plan.data?.max_photos ?? 0,
    active: active.count ?? 0,
    emailVerified: Boolean(priv.data?.email_verified_at),
  };
}
