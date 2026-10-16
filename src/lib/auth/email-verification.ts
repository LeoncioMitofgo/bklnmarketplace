import "server-only";
import { sendEmail } from "@/lib/email/send";
import { resetPasswordMessage, verifyEmailMessage } from "@/lib/email/templates";
import { randomToken, sha256 } from "@/lib/security";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // El email dice "24 horas" (emails.verify.expiry).

/**
 * Verificación de email propia (D-020): invalida los enlaces anteriores, guarda solo el hash
 * del nuevo token y envía el email. El token en claro solo viaja en el enlace.
 */
export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const admin = createAdminClient();
  const token = randomToken();

  await admin.from("email_verification_tokens").delete().eq("user_id", user.id).is("used_at", null);

  const { error } = await admin.from("email_verification_tokens").insert({
    token_hash: sha256(token),
    user_id: user.id,
    email: user.email,
    expires_at: new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`verification_token_insert: ${error.message}`);

  const url = `${siteUrl()}/verificar-email?token=${token}`;
  await sendEmail(await verifyEmailMessage(user.email, user.name, url));
}

/** Enlace de recuperación con el token de Supabase; se canjea en /nueva-contrasena con un POST. */
export async function sendPasswordResetEmail(to: string, name: string, tokenHash: string) {
  const url = `${siteUrl()}/nueva-contrasena?token=${encodeURIComponent(tokenHash)}`;
  await sendEmail(await resetPasswordMessage(to, name, url));
}
