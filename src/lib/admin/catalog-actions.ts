"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORY_ICON_NAMES } from "@/components/catalog/category-icon";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeGqPhone } from "@/lib/format";
import { PLANS_TAG } from "@/lib/premium/offer";
import { slugify } from "@/lib/slug";
import { adminClientOrNull, adminFailure, adminFeedback } from "./feedback";
import type { AdminActionState } from "./types";

// Catálogo y ajustes desde el panel (ALCANCE §4.11): categorías y atributos, ciudades, planes,
// precios, oficina, términos prohibidos y umbral de denuncias. La RLS solo deja escribir al admin.
// Nada del catálogo se borra (hay anuncios que dependen de él): se desactiva. Los atributos sí.

const CATALOG_TAG = "catalog";
const SETTINGS_TAG = "app-settings";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const bool = (formData: FormData, name: string) => formData.get(name) === "on";
const int = (formData: FormData, name: string) => Number.parseInt(text(formData, name), 10);
const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Una opción por línea, sin repetir. */
const lines = (value: string) => [
  ...new Set(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ),
];

function done(tag: string, key: string) {
  updateTag(tag);
  refresh();
  return adminFeedback(key);
}

// ─── Categorías ──────────────────────────────────────────────────────────────

/** Crear (con parentId o sin él, si es principal) o editar (con id) una categoría. */
export async function saveCategory(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");

  const id = int(formData, "id");
  const parentId = int(formData, "parentId");
  const name = text(formData, "name");
  const slug = slugify(text(formData, "slug") || name);
  const icon = text(formData, "icon");
  const pricePeriod = text(formData, "pricePeriod") === "month" ? "month" : "total";
  const sortOrder = int(formData, "sortOrder") || 0;
  if (name.length < 2 || name.length > 60) return adminFailure("name_length");
  if (slug.length < 2) return adminFailure("slug_invalid");
  if (!inRange(sortOrder, 0, 999)) return adminFailure("sort_invalid");
  if (icon && !CATEGORY_ICON_NAMES.includes(icon)) return adminFailure("unexpected");

  const row = {
    name,
    slug,
    icon: icon || null,
    price_required: bool(formData, "priceRequired"),
    price_period: pricePeriod,
    has_condition: bool(formData, "hasCondition"),
    sort_order: sortOrder,
    is_active: Number.isInteger(id) ? bool(formData, "isActive") : true,
  } as const;

  if (Number.isInteger(id)) {
    const { error } = await supabase.from("categories").update(row).eq("id", id);
    if (error) return adminFailure(error.code === "23505" ? "slug_taken" : error);
    // Una principal desactivada se lleva sus subcategorías: si no, quedarían sueltas en la búsqueda.
    if (!row.is_active) {
      await supabase.from("categories").update({ is_active: false }).eq("parent_id", id);
    }
    return done(CATALOG_TAG, "categorySaved");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...row, parent_id: Number.isInteger(parentId) ? parentId : null })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message === "categories_max_depth") return adminFailure("max_depth");
    return adminFailure(error?.code === "23505" ? "slug_taken" : error);
  }
  updateTag(CATALOG_TAG);
  redirect(`/admin/catalogo/categoria/${data.id}`);
}

// ─── Atributos ───────────────────────────────────────────────────────────────

const ATTRIBUTE_TYPES = ["text", "number", "select", "boolean"] as const;

/**
 * Crear (con categoryId) o editar (con id) un atributo. La clave y el tipo no se cambian después
 * de crearlo: los anuncios ya publicados guardan sus valores con esa clave.
 */
export async function saveAttribute(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");

  const id = int(formData, "id");
  const label = text(formData, "label");
  const unit = text(formData, "unit");
  const sortOrder = int(formData, "sortOrder") || 0;
  if (label.length < 1 || label.length > 60) return adminFailure("label_length");
  if (unit.length > 20 || !inRange(sortOrder, 0, 999)) return adminFailure("unexpected");

  let type: (typeof ATTRIBUTE_TYPES)[number];
  if (Number.isInteger(id)) {
    const { data: current } = await supabase
      .from("category_attributes")
      .select("type")
      .eq("id", id)
      .single();
    if (!current) return adminFailure("unexpected");
    type = current.type;
  } else {
    const chosen = ATTRIBUTE_TYPES.find((t) => t === text(formData, "type"));
    if (!chosen) return adminFailure("unexpected");
    type = chosen;
  }
  const options = type === "select" ? lines(text(formData, "options")) : null;
  if (options && options.length < 2) return adminFailure("options_required");

  const row = {
    label,
    options,
    unit: type === "number" ? unit || null : null,
    is_required: bool(formData, "isRequired"),
    is_filterable: bool(formData, "isFilterable"),
    sort_order: sortOrder,
  };

  if (Number.isInteger(id)) {
    const { error } = await supabase.from("category_attributes").update(row).eq("id", id);
    if (error) return adminFailure(error);
    return done(CATALOG_TAG, "attributeSaved");
  }

  const key = text(formData, "key").toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) return adminFailure("key_invalid");
  const { error } = await supabase
    .from("category_attributes")
    .insert({ ...row, key, type, category_id: int(formData, "categoryId") });
  if (error) return adminFailure(error.code === "23505" ? "key_taken" : error);
  return done(CATALOG_TAG, "attributeCreated");
}

export async function deleteAttribute(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");
  const { error } = await supabase
    .from("category_attributes")
    .delete()
    .eq("id", int(formData, "id"));
  if (error) return adminFailure(error);
  return done(CATALOG_TAG, "attributeDeleted");
}

// ─── Ciudades ────────────────────────────────────────────────────────────────

/** Crear (sin id) o editar una ciudad. Su slug (filtro `ciudad=` de la búsqueda) no cambia. */
export async function saveCity(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");

  const id = int(formData, "id");
  const name = text(formData, "name");
  const sortOrder = int(formData, "sortOrder") || 0;
  if (name.length < 2 || name.length > 60) return adminFailure("name_length");
  if (!inRange(sortOrder, 0, 999)) return adminFailure("sort_invalid");

  const { error } = Number.isInteger(id)
    ? await supabase
        .from("cities")
        .update({ name, sort_order: sortOrder, is_active: bool(formData, "isActive") })
        .eq("id", id)
    : await supabase.from("cities").insert({ name, slug: slugify(name), sort_order: sortOrder });
  if (error) return adminFailure(error.code === "23505" ? "slug_taken" : error);
  return done(CATALOG_TAG, Number.isInteger(id) ? "citySaved" : "cityCreated");
}

// ─── Planes y precios ────────────────────────────────────────────────────────

/** Límites de un plan. Si se bajan, el cron diario pausa los anuncios que sobren (1.2). */
export async function savePlan(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");

  const id = text(formData, "id");
  const maxActive = int(formData, "maxActiveListings");
  const maxPhotos = int(formData, "maxPhotos");
  const duration = int(formData, "durationDays");
  if (id !== "normal" && id !== "premium") return adminFailure("unexpected");
  if (!inRange(maxActive, 1, 10000) || !inRange(maxPhotos, 1, 30) || !inRange(duration, 1, 365)) {
    return adminFailure("plan_invalid");
  }
  const { error } = await supabase
    .from("plans")
    .update({
      max_active_listings: maxActive,
      max_photos: maxPhotos,
      listing_duration_days: duration,
    })
    .eq("id", id);
  if (error) return adminFailure(error);
  return done(PLANS_TAG, "planSaved");
}

/** Precio de Premium para un periodo (nuevo o existente); se puede retirar sin borrarlo. */
export async function savePrice(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const supabase = await adminClientOrNull();
  if (!supabase) return adminFailure("not_admin");

  const months = int(formData, "months");
  const price = Number.parseInt(text(formData, "price").replace(/\D/g, ""), 10);
  if (!inRange(months, 1, 24) || !inRange(price, 0, 10_000_000))
    return adminFailure("price_invalid");
  const { error } = await supabase.from("plan_prices").upsert({
    plan_id: "premium",
    months,
    price_xaf: price,
    // Una casilla sin marcar no se envía: hasActive dice que el formulario la tenía.
    is_active: formData.get("hasActive") === "1" ? bool(formData, "isActive") : true,
  });
  if (error) return adminFailure(error);
  return done(PLANS_TAG, "priceSaved");
}

// ─── Ajustes (app_settings) ──────────────────────────────────────────────────

async function saveSetting(key: string, value: unknown, feedbackKey: string) {
  const supabase = await adminClientOrNull();
  const user = await getSessionUser();
  if (!supabase || !user) return adminFailure("not_admin");
  const { error } = await supabase
    .from("app_settings")
    .update({ value: value as never, updated_by: user.id })
    .eq("key", key);
  if (error) return adminFailure(error);
  return done(SETTINGS_TAG, feedbackKey);
}

/** Datos de la oficina y de los pagos que se ven en "Hazte Premium" (D-025). */
export async function saveOffice(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const office = {
    name: text(formData, "name"),
    address: text(formData, "address"),
    hours: text(formData, "hours"),
    payments_whatsapp: normalizeGqPhone(text(formData, "paymentsWhatsapp")),
    agency_beneficiary: text(formData, "agencyBeneficiary"),
  };
  if (!office.payments_whatsapp) return adminFailure("phone_invalid");
  if (Object.values(office).some((v) => !v || v.length > 120))
    return adminFailure("office_invalid");
  return saveSetting("office", office, "officeSaved");
}

/** Términos prohibidos (D-056): uno por línea, se comparan por palabras completas. */
export async function saveBannedTerms(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const terms = lines(text(formData, "terms").toLowerCase());
  if (terms.length > 500 || terms.some((term) => term.length > 60))
    return adminFailure("terms_invalid");
  return saveSetting("banned_terms", terms, "termsSaved");
}

/** Denuncias de usuarios distintos que ocultan un anuncio (ALCANCE §5.5). */
export async function saveReportThreshold(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const threshold = int(formData, "threshold");
  if (!inRange(threshold, 1, 20)) return adminFailure("threshold_invalid");
  return saveSetting("report_hide_threshold", threshold, "thresholdSaved");
}
