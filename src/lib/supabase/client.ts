import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Cliente para componentes de cliente (chat en tiempo real, subida de fotos). Respeta RLS. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
