"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { attributesFor, getCatalog } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateDetails } from "./details";
import { type ImageFormat, imageFileName, LISTING_IMAGES_BUCKET } from "./images";
import { LISTINGS_TAG } from "./tags";

// Errores: claves bajo listings.errors. Las RPC lanzan P0001 con la clave como mensaje.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const RPC_ERRORS = new Set([
  "listing_not_found",
  "listing_invalid_transition",
  "email_not_verified",
  "account_restricted",
  "listing_limit_reached",
  "listing_incomplete",
  "listing_price_required",
  "listing_condition_required",
  "listing_photo_required",
  "listing_photo_limit",
  "listing_banned_term",
  "listing_duplicate",
  "listing_daily_limit",
  "listing_renew_not_allowed",
  "listing_category_not_leaf",
]);

/** Borradores abiertos a la vez por usuario (freno contra abusos, no es un límite de plan). */
const MAX_OPEN_DRAFTS = 10;

const EDITABLE_STATUSES = ["draft", "active", "paused", "sold", "expired"] as const;

function errorKey(error: { code?: string; message: string } | null): string {
  if (error?.code === "P0001" && RPC_ERRORS.has(error.message)) return error.message;
  console.error("listing_error", error?.code, error?.message);
  return "unexpected";
}

async function requireUser(next: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

function afterChange() {
  updateTag(LISTINGS_TAG);
  refresh();
}

// ─── Borrador ────────────────────────────────────────────────────────────────

export async function createDraft(): Promise<void> {
  const user = await requireUser("/publicar");
  const supabase = await createClient();

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "draft");
  if ((count ?? 0) >= MAX_OPEN_DRAFTS) redirect("/mis-anuncios?estado=borradores&aviso=borradores");

  const { data, error } = await supabase
    .from("listings")
    .insert({ is_negotiable: false })
    .select("id")
    .single();
  if (error || !data) throw new Error(`create_draft: ${error?.message}`);
  redirect(`/publicar/${data.id}`);
}

// ─── Fotos ───────────────────────────────────────────────────────────────────

export async function prepareImageUpload(
  listingId: string,
  format: ImageFormat,
): Promise<ActionResult<{ imageId: string; uploads: { large: string; thumb: string } }>> {
  const user = await requireUser(`/publicar/${listingId}`);
  if (format !== "webp" && format !== "jpg") return { ok: false, error: "unexpected" };

  const supabase = await createClient();
  const [listing, images, plan] = await Promise.all([
    supabase
      .from("listings")
      .select("id, status")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .in("status", EDITABLE_STATUSES)
      .maybeSingle(),
    supabase
      .from("listing_images")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId),
    supabase.rpc("current_plan", { p_user_id: user.id }),
  ]);
  if (!listing.data) return { ok: false, error: "listing_not_found" };
  if ((images.count ?? 0) >= (plan.data?.max_photos ?? 0)) {
    return { ok: false, error: "listing_photo_limit" };
  }

  const imageId = crypto.randomUUID();
  const base = `${user.id}/${listingId}/${imageId}`;
  const storage = createAdminClient().storage.from(LISTING_IMAGES_BUCKET);
  const [large, thumb] = await Promise.all([
    storage.createSignedUploadUrl(imageFileName(base, "large", format)),
    storage.createSignedUploadUrl(imageFileName(base, "thumb", format)),
  ]);
  if (large.error || thumb.error) {
    console.error("signed_upload_error", large.error?.message, thumb.error?.message);
    return { ok: false, error: "unexpected" };
  }
  return {
    ok: true,
    data: { imageId, uploads: { large: large.data.signedUrl, thumb: thumb.data.signedUrl } },
  };
}

async function removeImageFiles(base: string, format: string) {
  await createAdminClient()
    .storage.from(LISTING_IMAGES_BUCKET)
    .remove([
      imageFileName(base, "large", format as ImageFormat),
      imageFileName(base, "thumb", format as ImageFormat),
    ]);
}

export type SavedImage = {
  id: string;
  storage_path: string;
  format: string;
  width: number;
  height: number;
  position: number;
};

export async function confirmImageUpload(input: {
  listingId: string;
  imageId: string;
  format: ImageFormat;
  width: number;
  height: number;
}): Promise<ActionResult<SavedImage>> {
  const user = await requireUser(`/publicar/${input.listingId}`);
  const valid =
    (input.format === "webp" || input.format === "jpg") &&
    Number.isInteger(input.width) &&
    Number.isInteger(input.height) &&
    input.width > 0 &&
    input.height > 0 &&
    input.width <= 4000 &&
    input.height <= 4000;
  if (!valid) return { ok: false, error: "unexpected" };

  const base = `${user.id}/${input.listingId}/${input.imageId}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_images")
    .insert({
      id: input.imageId,
      listing_id: input.listingId,
      storage_path: base,
      format: input.format,
      width: input.width,
      height: input.height,
    })
    .select("id, storage_path, format, width, height, position")
    .single();

  if (error || !data) {
    await removeImageFiles(base, input.format);
    return { ok: false, error: errorKey(error) };
  }
  updateTag(LISTINGS_TAG);
  return { ok: true, data };
}

export async function deleteListingImage(imageId: string): Promise<ActionResult> {
  await requireUser("/mis-anuncios");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_images")
    .delete()
    .eq("id", imageId)
    .select("storage_path, format")
    .maybeSingle();
  if (error || !data) return { ok: false, error: errorKey(error) };

  await removeImageFiles(data.storage_path, data.format);
  updateTag(LISTINGS_TAG);
  return { ok: true, data: undefined };
}

export async function setCoverImage(imageId: string): Promise<ActionResult> {
  await requireUser("/mis-anuncios");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_listing_cover", { p_image_id: imageId });
  if (error) return { ok: false, error: errorKey(error) };
  updateTag(LISTINGS_TAG);
  return { ok: true, data: undefined };
}

// ─── Categoría y detalles ────────────────────────────────────────────────────

export async function saveCategory(listingId: string, categoryId: number): Promise<ActionResult> {
  const user = await requireUser(`/publicar/${listingId}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ category_id: categoryId })
    .eq("id", listingId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: errorKey(error) };
  updateTag(LISTINGS_TAG);
  return { ok: true, data: undefined };
}

export type DetailsState = {
  status: "idle" | "error" | "success";
  formError?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const listingId = String(formData.get("listingId") ?? "");
  const user = await requireUser(`/publicar/${listingId}`);
  const supabase = await createClient();

  const [{ data: listing }, catalog] = await Promise.all([
    supabase
      .from("listings")
      .select("category_id")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .in("status", EDITABLE_STATUSES)
      .maybeSingle(),
    getCatalog(),
  ]);
  const category = catalog.categories.find((c) => c.id === listing?.category_id);
  if (!listing || !category) return { status: "error", formError: "listing_incomplete" };

  const defs = attributesFor(catalog, category.id);
  const text = (name: string) => String(formData.get(name) ?? "");
  const { data, errors } = validateDetails(
    {
      title: text("title"),
      description: text("description"),
      condition: text("condition"),
      price: text("price"),
      negotiable: formData.get("negotiable") === "on",
      cityId: text("cityId"),
      neighborhood: text("neighborhood"),
      attributes: Object.fromEntries(defs.map((d) => [d.key, text(`attr_${d.key}`)])),
    },
    category,
    defs,
    new Set(catalog.cities.map((c) => c.id)),
  );
  if (!data) return { status: "error", fieldErrors: errors };

  const { error } = await supabase
    .from("listings")
    .update(data)
    .eq("id", listingId)
    .eq("user_id", user.id);
  if (error) return { status: "error", formError: errorKey(error) };

  updateTag(LISTINGS_TAG);
  return { status: "success" };
}

// ─── Publicar y cambios de estado ───────────────────────────────────────────

export async function publishListing(listingId: string): Promise<ActionResult> {
  await requireUser(`/publicar/${listingId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_listing", { p_listing_id: listingId });
  if (error) return { ok: false, error: errorKey(error) };
  updateTag(LISTINGS_TAG);
  redirect("/mis-anuncios?publicado=1");
}

const STATUS_RPC = {
  pause: "pause_listing",
  reactivate: "reactivate_listing",
  sold: "mark_listing_sold",
  renew: "renew_listing",
  delete: "delete_listing",
} as const;

export type StatusAction = keyof typeof STATUS_RPC;

export async function changeListingStatus(
  listingId: string,
  action: StatusAction,
): Promise<ActionResult> {
  await requireUser("/mis-anuncios");
  const rpc = STATUS_RPC[action];
  if (!rpc) return { ok: false, error: "unexpected" };

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_listing_id: listingId });
  if (error) return { ok: false, error: errorKey(error) };
  afterChange();
  return { ok: true, data: undefined };
}
