"use server";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/;

/**
 * Apunta una pulsación de «Llamar» como contacto (D-081). La RPC descarta las del dueño y las de
 * tiendas que no se ven o no tienen teléfono para llamadas.
 */
export async function registerCall(storeUserId: string, listingId: string | null): Promise<void> {
  if (!UUID.test(storeUserId) || (listingId !== null && !UUID.test(listingId))) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_call", {
    p_store_user_id: storeUserId,
    ...(listingId ? { p_listing_id: listingId } : {}),
  });
  if (error) console.error("register_call", error.code, error.message);
}
