import "server-only";
import { sha256 } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cuenta un intento y devuelve true si sigue dentro del límite.
 * La clave se guarda hasheada: ni teléfonos ni emails ni IPs en claro.
 * Si la base de datos falla, deja pasar (mejor que bloquear a todo el mundo) y lo registra.
 */
export async function hitRateLimit(
  scope: string,
  subject: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${scope}:${sha256(subject.toLowerCase())}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("rate_limit_error", scope, error.message);
    return true;
  }
  return data === true;
}
