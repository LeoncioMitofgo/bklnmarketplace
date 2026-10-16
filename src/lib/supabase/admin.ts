import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseUrl } from "./env";

/**
 * Cliente con la clave secreta: se salta RLS. Solo para lo que no puede hacer el usuario
 * (resolver el email del login, tareas de admin, crons). Nunca llega al navegador.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY. Revisa .env.local o las variables de Vercel.");
  }

  return createClient<Database>(supabaseUrl(), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
