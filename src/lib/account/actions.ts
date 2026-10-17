"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import { profileTag } from "@/lib/profiles";
import { hitRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Borrar la cuenta (ALCANCE §7, MODELO-DATOS §11). `error` es una clave bajo deleteAccount.errors.

export type DeleteAccountState = { error?: string };

const ATTEMPTS = 5;
const ATTEMPTS_WINDOW = 15 * 60;
/** Ficheros por llamada a la API de Storage. */
const REMOVE_BATCH = 1000;

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/borrar");

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "password_required" };
  }
  if (!(await hitRateLimit("delete_account", user.id, ATTEMPTS, ATTEMPTS_WINDOW))) {
    return { error: "too_many_attempts" };
  }

  // La contraseña se comprueba con un cliente sin cookies, para no tocar la sesión actual.
  const verifier = createStatelessClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: passwordError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError) return { error: "invalid_password" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  // Las claves foráneas hacen el resto: en cascada lo suyo, `set null` en mensajes y denuncias.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete_account", error.message);
    return { error: "unexpected" };
  }

  await signOutHere();
  updateTag(LISTINGS_TAG);
  if (profile) updateTag(profileTag(profile.username));
  after(() => removeStorageFiles(user.id));
  redirect("/cuenta-borrada");
}

/**
 * Quita la sesión de este navegador. El token sigue siendo válido hasta que caduca aunque la
 * cuenta ya no exista, así que, si signOut no pudiera borrar las cookies, se borran a mano.
 */
async function signOutHere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      cookieStore.delete(cookie.name);
    }
  }
}

/** Fotos de sus anuncios y de su perfil: Storage no se borra con las claves foráneas. */
async function removeStorageFiles(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("account_storage_objects", { p_user_id: userId });
  if (error) {
    console.error("delete_account_storage", error.message);
    return;
  }
  const byBucket = new Map<string, string[]>();
  for (const object of data ?? []) {
    byBucket.set(object.bucket_id, [...(byBucket.get(object.bucket_id) ?? []), object.name]);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += REMOVE_BATCH) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(names.slice(i, i + REMOVE_BATCH));
      if (removeError) console.error("delete_account_storage", bucket, removeError.message);
    }
  }
}
