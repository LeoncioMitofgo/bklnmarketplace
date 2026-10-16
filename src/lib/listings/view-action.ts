"use server";

import { createClient } from "@/lib/supabase/server";

/** Suma una vista al anuncio (MODELO-DATOS §5.8). Las del vendedor no cuentan: lo decide la RPC. */
export async function registerListingView(listingId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(listingId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_listing_view", { p_listing_id: listingId });
  if (error) console.error("listing_view", error.code, error.message);
}
