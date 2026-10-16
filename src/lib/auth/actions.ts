"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth/email-verification";
import type { FormState } from "@/lib/auth/form-state";
import { safeNextPath } from "@/lib/auth/next-path";
import { fieldErrorsOf, passwordSchema, signUpSchema } from "@/lib/auth/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeGqPhone } from "@/lib/format";
import { detectIdentifierKind, maskEmail } from "@/lib/identifiers";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, sha256 } from "@/lib/security";
import { getRateLimits } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const FIFTEEN_MIN = 15 * 60;
const ONE_HOUR = 60 * 60;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Clave estable para limitar intentos aunque el teléfono se escriba de formas distintas. */
function identifierKey(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (detectIdentifierKind(value) === "phone") return normalizeGqPhone(value) ?? value;
  return value;
}

function runAfter(label: string, task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(label, error);
    }
  });
}

// ─── Registro ────────────────────────────────────────────────────────────────

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    displayName: text(formData, "displayName"),
    username: text(formData, "username"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
  };
  const next = safeNextPath(text(formData, "next"), "/cuenta");

  const parsed = signUpSchema.safeParse({
    ...values,
    password: text(formData, "password"),
    terms: formData.get("terms") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const input = parsed.data;

  const limits = await getRateLimits();
  if (
    !(await hitRateLimit("signup:ip", await clientIp(), limits.signups_per_hour_per_ip, ONE_HOUR))
  ) {
    return { status: "error", formError: "form.tooManyAttempts", values };
  }

  // Unicidad antes de crear la cuenta, para dar errores claros por campo (el trigger es la red de seguridad).
  const admin = createAdminClient();
  const [reserved, usernameTaken, phoneTaken] = await Promise.all([
    admin.rpc("is_reserved_username", { p_username: input.username }),
    admin.from("profiles").select("id").eq("username", input.username).maybeSingle(),
    admin.from("profile_private").select("user_id").eq("phone", input.phone).maybeSingle(),
  ]);
  const fieldErrors: Record<string, string> = {};
  if (reserved.data === true || usernameTaken.data) fieldErrors.username = "username.taken";
  if (phoneTaken.data) fieldErrors.phone = "phone.taken";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { username: input.username, display_name: input.displayName, phone: input.phone },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "error", fieldErrors: { email: "email.taken" }, values };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "password.weak" }, values };
    }
    console.error("signup_error", error.code, error.message);
    return { status: "error", formError: "form.signupFailed", values };
  }

  if (!data.session || !data.user) {
    // "Confirm email" sigue activado en Supabase: la cuenta existe pero no hay sesión (ver D-020).
    console.error("signup_without_session: desactiva 'Confirm email' en Supabase Auth");
    return { status: "success", message: "accountCreatedConfirm" };
  }

  const user = { id: data.user.id, email: input.email, name: input.displayName };
  runAfter("verification_email_error", () => sendVerificationEmail(user));
  redirect(next);
}

// ─── Entrar ──────────────────────────────────────────────────────────────────

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = text(formData, "identifier").trim();
  const password = text(formData, "password");
  const next = safeNextPath(text(formData, "next"), "/");
  const values = { identifier };

  if (!identifier || !password) {
    return { status: "error", formError: "form.credentialsRequired", values };
  }

  const limits = await getRateLimits();
  const [byIdentifier, byIp] = await Promise.all([
    hitRateLimit(
      "login:id",
      identifierKey(identifier),
      limits.login_attempts_per_15_min,
      FIFTEEN_MIN,
    ),
    hitRateLimit(
      "login:ip",
      await clientIp(),
      limits.login_attempts_per_15_min_per_ip,
      FIFTEEN_MIN,
    ),
  ]);
  if (!byIdentifier || !byIp) {
    return { status: "error", formError: "form.tooManyAttempts", values };
  }

  // El email se resuelve en el servidor y nunca llega al navegador (D-012).
  const { data: email } = await createAdminClient().rpc("resolve_login_email", {
    p_identifier: identifier,
  });
  if (!email) {
    return { status: "error", formError: "form.invalidCredentials", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", formError: "form.emailNotConfirmed", values };
    }
    return { status: "error", formError: "form.invalidCredentials", values };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ─── Recuperar contraseña ───────────────────────────────────────────────────

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const identifier = text(formData, "identifier").trim();
  const values = { identifier };
  if (!identifier) {
    return { status: "error", formError: "form.identifierRequired", values };
  }

  const limits = await getRateLimits();
  const [byIdentifier, byIp] = await Promise.all([
    hitRateLimit("reset:id", identifierKey(identifier), limits.password_resets_per_hour, ONE_HOUR),
    hitRateLimit("reset:ip", await clientIp(), limits.password_resets_per_hour * 5, ONE_HOUR),
  ]);
  if (!byIdentifier || !byIp) {
    return { status: "error", formError: "form.tooManyAttempts", values };
  }

  const admin = createAdminClient();
  const { data: email } = await admin.rpc("resolve_login_email", { p_identifier: identifier });
  if (!email) {
    return { status: "error", formError: "form.accountNotFound", values };
  }

  // generateLink no envía nada: el email lo mandamos nosotros, en español y con nuestro enlace.
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) {
    if (error?.status === 404 || error?.code === "user_not_found") {
      return { status: "error", formError: "form.accountNotFound", values };
    }
    console.error("reset_link_error", error?.code, error?.message);
    return { status: "error", formError: "form.unexpected", values };
  }

  const name = String(data.user.user_metadata?.display_name ?? "");
  const tokenHash = data.properties.hashed_token;
  runAfter("reset_email_error", () => sendPasswordResetEmail(email, name, tokenHash));

  return { status: "success", message: "resetSent", messageValues: { email: maskEmail(email) } };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const tokenHash = text(formData, "token");
  const parsed = passwordSchema.safeParse(text(formData, "password"));
  if (!parsed.success) {
    return { status: "error", fieldErrors: { password: parsed.error.issues[0].message } };
  }
  if (!tokenHash) {
    return { status: "error", formError: "form.linkInvalid" };
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (otpError) {
    return { status: "error", formError: "form.linkInvalid" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "password.weak" } };
    }
    console.error("update_password_error", error.code, error.message);
    return { status: "error", formError: "form.unexpected" };
  }

  redirect("/cuenta");
}

// ─── Verificación de email ──────────────────────────────────────────────────

/** Se canjea con un POST (botón), no al abrir el enlace: los antivirus de correo abren los enlaces solos. */
export async function confirmEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  if (!token) {
    return { status: "error", formError: "form.linkInvalid" };
  }

  const { data: userId, error } = await createAdminClient().rpc(
    "consume_email_verification_token",
    { p_token_hash: sha256(token) },
  );
  if (error) {
    console.error("confirm_email_error", error.message);
    return { status: "error", formError: "form.unexpected" };
  }
  if (!userId) {
    return { status: "error", formError: "form.linkInvalid" };
  }

  return { status: "success", message: "emailConfirmed" };
}

export async function resendVerificationEmail(_prev: FormState): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta");

  const limits = await getRateLimits();
  if (
    !(await hitRateLimit("verify:user", user.id, limits.verification_emails_per_hour, ONE_HOUR))
  ) {
    return { status: "error", formError: "form.tooManyAttempts" };
  }

  const admin = createAdminClient();
  const [{ data: priv }, { data: profile }] = await Promise.all([
    admin.from("profile_private").select("email_verified_at").eq("user_id", user.id).single(),
    admin.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  if (priv?.email_verified_at) {
    return { status: "success", message: "alreadyVerified" };
  }

  runAfter("verification_email_error", () =>
    sendVerificationEmail({ id: user.id, email: user.email, name: profile?.display_name ?? "" }),
  );
  return {
    status: "success",
    message: "verificationResent",
    messageValues: { email: maskEmail(user.email) },
  };
}
