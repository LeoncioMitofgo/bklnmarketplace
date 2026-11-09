"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { FormState } from "@/lib/auth/form-state";
import { fieldErrorsOf } from "@/lib/auth/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeGqPhone } from "@/lib/format";
import type { ImageFormat } from "@/lib/listings/images";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import { PROFILE_MEDIA_BUCKET } from "@/lib/profile-media";
import { profileTag } from "@/lib/profiles";
import { hitRateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicStore, storeTag } from "./public";
import {
  isStoreMediaPath,
  normalizeStoreSlug,
  STORE_SLUG_PATTERN,
  type StoreMediaKind,
} from "./slug";

// Tienda Premium (ALCANCE §4.8). Las claves de error y los mensajes van en store.errors y
// store.messages. La RLS de stores solo deja crearla o editarla con Premium activo.

const MEDIA_UPLOADS_PER_HOUR = 20;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/tienda");
  return user;
}

const isPremium = (premiumUntil: string | null) =>
  premiumUntil !== null && Date.parse(premiumUntil) > Date.now();

/** La tienda, el perfil y los anuncios (enlace "Ver su tienda" en la ficha) dejan de estar al día. */
function storeChanged(username: string, ...slugs: string[]) {
  for (const slug of new Set(slugs)) updateTag(storeTag(slug));
  updateTag(profileTag(username));
  updateTag(LISTINGS_TAG);
  updateTag("stores");
}

const storeSchema = z.object({
  name: z.string().trim().min(2, { error: "name.length" }).max(60, { error: "name.length" }),
  slug: z
    .string()
    .transform(normalizeStoreSlug)
    .pipe(z.string().regex(STORE_SLUG_PATTERN, { error: "slug.format" })),
  description: z.string().trim().max(1000, { error: "description.length" }),
  address: z.string().trim().max(200, { error: "address.length" }),
  openingHours: z.string().trim().max(120, { error: "openingHours.length" }),
  // Teléfono para llamadas (D-081): opcional y público. Vacío → null.
  callPhone: z.string().transform((value, ctx) => {
    if (value.trim() === "") return null;
    const phone = normalizeGqPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "callPhone.format" });
      return z.NEVER;
    }
    return phone;
  }),
});

/** Crea la tienda o guarda los cambios. */
export async function saveStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    address: text(formData, "address"),
    openingHours: text(formData, "openingHours"),
    callPhone: text(formData, "callPhone"),
  };
  const parsed = storeSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  const [{ data: profile }, { data: current }] = await Promise.all([
    supabase.from("profiles").select("username, premium_until").eq("id", user.id).single(),
    supabase.from("stores").select("slug").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile) return { status: "error", formError: "unexpected", values };
  if (!isPremium(profile.premium_until)) {
    return { status: "error", formError: "premium_required", values };
  }

  const { data: taken } = await createAdminClient()
    .from("stores")
    .select("user_id")
    .eq("slug", input.slug)
    .neq("user_id", user.id)
    .maybeSingle();
  if (taken) return { status: "error", fieldErrors: { slug: "slug.taken" }, values };

  const row = {
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    address: input.address || null,
    opening_hours: input.openingHours || null,
    call_phone: input.callPhone,
  };
  const { error } = current
    ? await supabase.from("stores").update(row).eq("user_id", user.id)
    : await supabase.from("stores").insert({ user_id: user.id, ...row });
  if (error) {
    if (error.code === "23505")
      return { status: "error", fieldErrors: { slug: "slug.taken" }, values };
    console.error("save_store", error.code, error.message);
    return { status: "error", formError: "unexpected", values };
  }

  storeChanged(profile.username, input.slug, ...(current ? [current.slug] : []));
  refresh();
  return {
    status: "success",
    message: current ? "saved" : "created",
    values: { ...values, slug: input.slug },
  };
}

// ─── Logo y portada ──────────────────────────────────────────────────────────

const isKind = (kind: string): kind is StoreMediaKind => kind === "logo" || kind === "cover";

/** URL firmada para subir el logo o la portada (los usuarios no escriben en Storage, D-039). */
export async function prepareStoreImage(
  kind: StoreMediaKind,
  format: ImageFormat,
): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!isKind(kind) || (format !== "webp" && format !== "jpg"))
    return { ok: false, error: "unexpected" };
  if (!(await hitRateLimit("store_upload", user.id, MEDIA_UPLOADS_PER_HOUR, 3600))) {
    return { ok: false, error: "rate_limited" };
  }

  const path = `${user.id}/${kind}-${crypto.randomUUID()}.${format}`;
  const { data, error } = await createAdminClient()
    .storage.from(PROFILE_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("store_signed_upload", error?.message);
    return { ok: false, error: "unexpected" };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

/** Después de subirla: comprueba que existe, la pone en la tienda y borra la anterior. */
export async function saveStoreImage(
  kind: StoreMediaKind,
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!isKind(kind) || !isStoreMediaPath(path, user.id, kind))
    return { ok: false, error: "unexpected" };

  const fileName = path.slice(user.id.length + 1);
  const { data: files } = await createAdminClient()
    .storage.from(PROFILE_MEDIA_BUCKET)
    .list(user.id, { search: fileName });
  if (!files?.some((f) => f.name === fileName)) return { ok: false, error: "unexpected" };
  return replaceStoreImage(user.id, kind, path);
}

export async function removeStoreImage(formData: FormData): Promise<void> {
  const user = await requireUser();
  const kind = text(formData, "kind");
  if (isKind(kind)) await replaceStoreImage(user.id, kind, null);
}

async function replaceStoreImage(
  userId: string,
  kind: StoreMediaKind,
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const column = kind === "logo" ? "logo_path" : "cover_path";
  const supabase = await createClient();
  const [{ data: store }, { data: profile }] = await Promise.all([
    supabase
      .from("stores")
      .select("slug, logo_path, cover_path")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("username").eq("id", userId).single(),
  ]);
  if (!store || !profile) return { ok: false, error: "unexpected" };

  // La RLS solo deja editar la tienda con Premium activo.
  const { data: updated, error } = await supabase
    .from("stores")
    .update(kind === "logo" ? { logo_path: path } : { cover_path: path })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !updated?.length) {
    if (error) console.error("store_image", error.code, error.message);
    return { ok: false, error: "unexpected" };
  }
  const previous = store[column];
  if (previous && previous !== path) {
    await createAdminClient().storage.from(PROFILE_MEDIA_BUCKET).remove([previous]);
  }
  storeChanged(profile.username, store.slug);
  refresh();
  return { ok: true };
}

// ─── WhatsApp de la tienda ───────────────────────────────────────────────────

/**
 * Botón de WhatsApp de la tienda: como el de la ficha (D-050), pide el teléfono al pulsar, con
 * tope diario, y abre wa.me con la tienda en el mensaje. Sin JavaScript también funciona.
 */
export async function openStoreWhatsApp(
  _previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const slug = text(formData, "slug");
  const store = STORE_SLUG_PATTERN.test(slug) ? await getPublicStore(slug) : null;
  if (!store) return { error: "whatsapp_unavailable" };
  if (!(await getSessionUser())) redirect(`/entrar?next=${encodeURIComponent(`/t/${slug}`)}`);

  const supabase = await createClient();
  const { data: phone, error } = await supabase.rpc("store_whatsapp_contact", {
    p_user_id: store.user_id,
  });
  if (error || !phone) {
    const known = [
      "whatsapp_unavailable",
      "user_blocked",
      "chat_rate_limited",
      "account_restricted",
    ];
    if (error?.code === "P0001" && known.includes(error.message)) return { error: error.message };
    if (error) console.error("store_whatsapp", error.code, error.message);
    return { error: "unexpected" };
  }
  const t = await getTranslations("store");
  const message = t("whatsappText", { name: store.name, url: `${siteUrl()}/t/${slug}` });
  redirect(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
}
