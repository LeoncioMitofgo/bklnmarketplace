"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import type { FormState } from "@/lib/auth/form-state";
import {
  displayNameSchema,
  emailSchema,
  fieldErrorsOf,
  passwordSchema,
  phoneSchema,
  usernameSchema,
} from "@/lib/auth/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import { AVATAR_PATH, PROFILE_MEDIA_BUCKET } from "@/lib/profile-media";
import { profileTag } from "@/lib/profiles";
import { hitRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkCurrentPassword } from "./password";

// Editar el perfil y los datos de la cuenta (ALCANCE §4.3 y §5.7). Las claves de error son las de
// auth.errors (las mismas del registro) y los mensajes, los de auth.messages.

const BIO_MAX = 300;
const AVATAR_UPLOADS_PER_HOUR = 10;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

async function requireUser(next: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

/** El nombre o el usuario salen en el perfil público y en la ficha de cada anuncio. */
function publicProfileChanged(...usernames: string[]) {
  for (const username of new Set(usernames)) updateTag(profileTag(username));
  updateTag(LISTINGS_TAG);
}

/** Error de la contraseña actual → campo del formulario o error general. */
function passwordFailure(
  error: "password_required" | "too_many_attempts" | "invalid_password",
  values: Record<string, string>,
): FormState {
  if (error === "too_many_attempts")
    return { status: "error", formError: "form.tooManyAttempts", values };
  const key =
    error === "password_required" ? "currentPassword.required" : "currentPassword.invalid";
  return { status: "error", fieldErrors: { currentPassword: key }, values };
}

// ─── Perfil público ──────────────────────────────────────────────────────────

const profileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  cityId: z.string().transform((value) => (value ? Number.parseInt(value, 10) : null)),
  bio: z.string().trim().max(BIO_MAX, { error: "bio.length" }),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/cuenta/perfil");
  const values = {
    displayName: text(formData, "displayName"),
    username: text(formData, "username"),
    cityId: text(formData, "cityId"),
    bio: text(formData, "bio"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  const input = parsed.data;

  const catalog = await getCatalog();
  if (input.cityId !== null && !catalog.cities.some((c) => c.id === input.cityId)) {
    return { status: "error", fieldErrors: { cityId: "city.invalid" }, values };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (!current) return { status: "error", formError: "form.unexpected", values };

  if (input.username !== current.username) {
    const admin = createAdminClient();
    const [reserved, taken] = await Promise.all([
      admin.rpc("is_reserved_username", { p_username: input.username }),
      admin.from("profiles").select("id").eq("username", input.username).maybeSingle(),
    ]);
    if (reserved.data === true || taken.data) {
      return { status: "error", fieldErrors: { username: "username.taken" }, values };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      username: input.username,
      city_id: input.cityId,
      bio: input.bio || null,
    })
    .eq("id", user.id);
  if (error) {
    // Carrera con otro usuario que acaba de coger el mismo nombre (índice único o trigger).
    if (error.code === "23505" || error.message === "username_reserved") {
      return { status: "error", fieldErrors: { username: "username.taken" }, values };
    }
    console.error("update_profile", error.code, error.message);
    return { status: "error", formError: "form.unexpected", values };
  }

  publicProfileChanged(current.username, input.username);
  refresh();
  return {
    status: "success",
    message: "profileSaved",
    values: { ...values, username: input.username },
  };
}

// ─── Foto de perfil ──────────────────────────────────────────────────────────

export type AvatarResult = { ok: true } | { ok: false; error: string };

/** URL firmada para subir la foto (los usuarios no escriben en Storage, D-039). */
export async function prepareAvatarUpload(
  format: "webp" | "jpg",
): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (format !== "webp" && format !== "jpg") return { ok: false, error: "unexpected" };
  if (!(await hitRateLimit("avatar_upload", user.id, AVATAR_UPLOADS_PER_HOUR, 3600))) {
    return { ok: false, error: "rate_limited" };
  }

  const path = `${user.id}/avatar-${crypto.randomUUID()}.${format}`;
  const { data, error } = await createAdminClient()
    .storage.from(PROFILE_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("avatar_signed_upload", error?.message);
    return { ok: false, error: "unexpected" };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

/** Después de subirla: comprueba que existe, la pone en el perfil y borra la anterior. */
export async function saveAvatar(path: string): Promise<AvatarResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!AVATAR_PATH.test(path) || !path.startsWith(`${user.id}/`))
    return { ok: false, error: "unexpected" };

  const admin = createAdminClient();
  const fileName = path.slice(user.id.length + 1);
  const { data: files } = await admin.storage
    .from(PROFILE_MEDIA_BUCKET)
    .list(user.id, { search: fileName });
  if (!files?.some((f) => f.name === fileName)) return { ok: false, error: "unexpected" };

  return replaceAvatar(user.id, path);
}

export async function removeAvatar(): Promise<void> {
  const user = await requireUser("/cuenta/perfil");
  await replaceAvatar(user.id, null);
}

async function replaceAvatar(userId: string, path: string | null): Promise<AvatarResult> {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("username, avatar_path")
    .eq("id", userId)
    .single();
  if (!current) return { ok: false, error: "unexpected" };

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    console.error("save_avatar", error.code, error.message);
    return { ok: false, error: "unexpected" };
  }
  if (current.avatar_path && current.avatar_path !== path) {
    await createAdminClient().storage.from(PROFILE_MEDIA_BUCKET).remove([current.avatar_path]);
  }
  publicProfileChanged(current.username);
  refresh();
  return { ok: true };
}

// ─── Email, teléfono y contraseña ───────────────────────────────────────────

/** Cambia el email (hay que volver a confirmarlo para publicar: trigger de auth.users, D-020). */
export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/cuenta/acceso");
  const values = { email: text(formData, "email") };
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) return { status: "error", fieldErrors: { email: "email.format" }, values };
  const email = parsed.data;
  if (email === user.email.toLowerCase()) {
    return { status: "error", fieldErrors: { email: "email.same" }, values };
  }

  const passwordError = await checkCurrentPassword(user, text(formData, "currentPassword"));
  if (passwordError) return passwordFailure(passwordError, values);

  // Después de la contraseña, para que no sirva para averiguar qué emails tienen cuenta. La API de
  // admin responde con un error genérico si el email existe: por eso se mira antes.
  const admin = createAdminClient();
  const { data: taken } = await admin.rpc("email_taken", { p_email: email });
  if (taken) return { status: "error", fieldErrors: { email: "email.taken" }, values };

  const { error } = await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true });
  if (error) {
    console.error("change_email", error.code, error.message);
    return { status: "error", formError: "form.unexpected", values };
  }

  // Sesión nueva con el email nuevo (el token anterior lo llevaba dentro).
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const target = { id: user.id, email, name: profile?.display_name ?? "" };
  after(async () => {
    try {
      await sendVerificationEmail(target);
    } catch (error) {
      console.error("verification_email_error", error);
    }
  });
  refresh();
  return { status: "success", message: "emailChanged", messageValues: { email } };
}

export async function changePhone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/cuenta/acceso");
  const values = { phone: text(formData, "phone") };
  const parsed = phoneSchema.safeParse(values.phone);
  if (!parsed.success) return { status: "error", fieldErrors: { phone: "phone.format" }, values };
  const phone = parsed.data;

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("profile_private")
    .select("phone")
    .eq("user_id", user.id)
    .single();
  if (current?.phone === phone)
    return { status: "error", fieldErrors: { phone: "phone.same" }, values };

  const passwordError = await checkCurrentPassword(user, text(formData, "currentPassword"));
  if (passwordError) return passwordFailure(passwordError, values);

  // El teléfono no se cambia con la sesión del usuario (permisos por columna): lo hace el servidor.
  const { error } = await admin.from("profile_private").update({ phone }).eq("user_id", user.id);
  if (error) {
    if (error.code === "23505")
      return { status: "error", fieldErrors: { phone: "phone.taken" }, values };
    console.error("change_phone", error.code, error.message);
    return { status: "error", formError: "form.unexpected", values };
  }
  refresh();
  return { status: "success", message: "phoneChanged" };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/cuenta/acceso");
  const parsed = passwordSchema.safeParse(text(formData, "newPassword"));
  if (!parsed.success) return { status: "error", fieldErrors: { newPassword: "password.length" } };

  const passwordError = await checkCurrentPassword(user, text(formData, "currentPassword"));
  if (passwordError) return passwordFailure(passwordError, {});

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    password: parsed.data,
  });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") {
      return { status: "error", fieldErrors: { newPassword: "password.weak" } };
    }
    console.error("change_password", error.code, error.message);
    return { status: "error", formError: "form.unexpected" };
  }

  // Si alguien más tenía la cuenta abierta, se queda fuera; este móvil sigue dentro.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  return { status: "success", message: "passwordChanged" };
}
