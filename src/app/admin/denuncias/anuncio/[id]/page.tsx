import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TextAreaField } from "@/components/admin/text-area-field";
import { moderateListing } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getCatalog } from "@/lib/catalog";
import { imageUrl } from "@/lib/listings/images";
import { listingPath } from "@/lib/listings/paths";
import { priceLabel } from "@/lib/listings/price";

// Un anuncio denunciado: contenido, denuncias y acciones (bloquear, restaurar o descartar).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.listing");
  return { title: t("title") };
}

export default function AdminListingPage({ params }: PageProps<"/admin/denuncias/anuncio/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminListing params={params} />
    </Suspense>
  );
}

async function AdminListing({
  params,
}: Pick<PageProps<"/admin/denuncias/anuncio/[id]">, "params">) {
  const { id } = await params;
  const { supabase } = await requireAdmin(`/admin/denuncias/anuncio/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [{ data: listing }, { data: reports }, catalog, t, tReasons, tPrice, format] =
    await Promise.all([
      supabase
        .from("listings")
        .select(
          "id, code, title, description, price_xaf, status, moderation_reason, city_id, category_id, user_id, seller:profiles!listings_user_id_fkey(id, username, display_name), images:listing_images(storage_path, format, position)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("reports")
        .select(
          "id, reason, details, status, created_at, resolution_note, reporter:profiles!reports_reporter_id_fkey(username)",
        )
        .eq("listing_id", id)
        .order("created_at", { ascending: false }),
      getCatalog(),
      getTranslations("admin.listing"),
      getTranslations("admin.reasons"),
      getTranslations("price"),
      getFormatter(),
    ]);
  if (!listing) notFound();

  const category = catalog.categories.find((c) => c.id === listing.category_id);
  const city = catalog.cities.find((c) => c.id === listing.city_id)?.name ?? null;
  const cover = [...listing.images].sort((a, b) => a.position - b.position)[0];
  const open = (reports ?? []).filter((r) => r.status === "open");
  const canBlock = ["active", "paused", "sold", "expired", "under_review"].includes(listing.status);
  const canRestore = ["under_review", "blocked"].includes(listing.status);
  const canDismiss = open.length > 0 && !canRestore;
  const isPublic = listing.status === "active" || listing.status === "sold";
  const tStatus = await getTranslations("admin.reports.status");

  return (
    <AdminShell active="reports">
      <Link href="/admin/denuncias" className="-mb-2 text-sm font-semibold text-primary">
        {t("back")}
      </Link>
      <section className="flex gap-3">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: imágenes ya optimizadas en el móvil (ARQUITECTURA §5.2).
          <img
            src={imageUrl(cover.storage_path, cover.format, "thumb")}
            alt=""
            width={96}
            height={72}
            className="h-[72px] w-24 shrink-0 rounded-control object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-lg font-extrabold leading-snug">{listing.title ?? t("untitled")}</h1>
          <p className="font-semibold text-primary">
            {priceLabel(listing.price_xaf, category, tPrice)}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={listing.status} label={tStatus(listing.status)} />
            {[category?.name, city].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      {listing.moderation_reason ? (
        <p className="rounded-control bg-surface px-3.5 py-3 text-sm">
          {t("blockedReason", { reason: listing.moderation_reason })}
        </p>
      ) : null}
      {listing.description ? (
        <p className="whitespace-pre-line break-words text-sm leading-relaxed">
          {listing.description}
        </p>
      ) : null}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {listing.seller ? (
          <Link
            href={`/admin/usuarios/${listing.seller.id}`}
            className="font-semibold text-primary"
          >
            {t("seller", { name: listing.seller.display_name, username: listing.seller.username })}
          </Link>
        ) : null}
        {isPublic ? (
          <Link
            href={listingPath(listing.code, listing.title, city)}
            className="font-semibold text-primary"
          >
            {t("viewPublic")}
          </Link>
        ) : null}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("reports", { count: open.length })}</h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {(reports ?? []).map((r) => (
            <li
              key={r.id}
              className={`flex flex-col gap-1 p-3 text-sm ${r.status === "open" ? "" : "opacity-60"}`}
            >
              <span className="font-semibold">
                {tReasons(r.reason)}
                {r.status === "open" ? "" : ` · ${t(`reportStatus.${r.status}`)}`}
              </span>
              {r.details ? (
                <span className="whitespace-pre-line break-words">{r.details}</span>
              ) : null}
              <span className="text-xs text-text-muted">
                {t("by", {
                  username: r.reporter?.username ?? t("deletedUser"),
                  date: format.dateTime(new Date(r.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  }),
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {canBlock || canRestore || canDismiss ? (
        <section className="flex flex-col gap-2 rounded-card border border-border p-4">
          <h2 className="font-sans text-base font-bold">{t("moderateTitle")}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
            {canBlock ? <li>{t("blockHint")}</li> : null}
            {canRestore ? <li>{t("restoreHint")}</li> : null}
            {canDismiss ? <li>{t("dismissHint")}</li> : null}
          </ul>
          {/* Un solo formulario: sigue en la página tras bloquear o restaurar y conserva el mensaje. */}
          <AdminActionForm
            action={moderateListing}
            pendingLabel={t("working")}
            buttons={[
              ...(canBlock
                ? [{ label: t("block"), intent: "block", variant: "danger" as const }]
                : []),
              ...(canRestore ? [{ label: t("restore"), intent: "restore" }] : []),
              ...(canDismiss
                ? [{ label: t("dismiss"), intent: "dismiss", variant: "secondary" as const }]
                : []),
            ]}
          >
            <input type="hidden" name="listingId" value={listing.id} />
            <TextAreaField
              id="moderation-reason"
              name="reason"
              label={t("reason")}
              placeholder={t("reasonPlaceholder")}
              required={false}
            />
          </AdminActionForm>
        </section>
      ) : null}
    </AdminShell>
  );
}
