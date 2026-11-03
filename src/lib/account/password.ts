import "server-only";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { hitRateLimit, rateLimitReached } from "@/lib/rate-limit";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

const ATTEMPTS = 5;
const ATTEMPTS_WINDOW = 15 * 60;

/**
 * Comprueba la contraseña actual antes de un cambio delicado (email, teléfono, contraseña, borrar
 * la cuenta). Como mucho 5 fallos cada 15 minutos por usuario: solo cuentan los fallos, pero el
 * límite se mira antes de probar la contraseña. Usa un cliente sin cookies para no tocar la sesión.
 * Devuelve null si es correcta o la clave del error.
 */
export async function checkCurrentPassword(
  user: { id: string; email: string },
  password: string,
): Promise<"password_required" | "too_many_attempts" | "invalid_password" | null> {
  if (!password) return "password_required";
  if (await rateLimitReached("account_password", user.id, ATTEMPTS, ATTEMPTS_WINDOW)) {
    return "too_many_attempts";
  }
  const verifier = createStatelessClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (!error) return null;
  await hitRateLimit("account_password", user.id, ATTEMPTS, ATTEMPTS_WINDOW);
  return "invalid_password";
}
