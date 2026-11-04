import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Email y nombre de un usuario para los avisos por email, o null si no se le escribe: cuentas de
 * demostración (D-047), emails sin confirmar (rebotarían), avisos desactivados o cuenta baneada.
 */
export async function emailRecipient(
  db: Db,
  userId: string,
): Promise<{ email: string; name: string } | null> {
  const [{ data: auth }, { data: settings }, { data: profile }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from("profile_private")
      .select("email_verified_at, notify_email")
      .eq("user_id", userId)
      .single(),
    db.from("profiles").select("display_name, status").eq("id", userId).single(),
  ]);
  const email = auth.user?.email;
  if (!email || auth.user?.user_metadata?.demo) return null;
  if (!settings?.email_verified_at || !settings.notify_email) return null;
  if (!profile || profile.status === "banned") return null;
  return { email, name: profile.display_name };
}

/** Resend deja 2 envíos por segundo en el plan gratuito: se espera esto entre uno y otro. */
export const waitBetweenEmails = () => new Promise((r) => setTimeout(r, 600));
