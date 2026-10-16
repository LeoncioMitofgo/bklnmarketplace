import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { ListingRowActions } from "@/components/listings/listing-row-actions";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { formatXaf } from "@/lib/format";
import { imageUrl } from "@/lib/listings/images";
import { listingPath } from "@/lib/listings/paths";
import {
  getMyListings,
  getPlanUsage,
  type ListingStatus,
  type MyListing,
} from "@/lib/listings/queries";
import { getRenewWindowDays } from "@/lib/settings";

const TABS = {
  activos: ["active", "under_review", "blocked"],
  pausados: ["paused"],
  vendidos: ["sold"],
  caducados: ["expired"],
  borradores: ["draft"],
} as const satisfies Record<string, readonly ListingStatus[]>;

type Tab = keyof typeof TABS;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("listings.mine");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MyListingsPage({ searchParams }: PageProps<"/mis-anuncios">) {
  const t = await getTranslations("listings.mine");
  return (
    <main className="flex flex-col gap-4 px-4 pt-6">
      <Suspense fallback={<p className="text-text-muted">{t("loading")}</p>}>
        <MyListingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyListingsContent({
  searchParams,
}: Pick<PageProps<"/mis-anuncios">, "searchParams">) {
  const params = await searchParams;
  const tab: Tab =
    typeof params.estado === "string" && params.estado in TABS ? (params.estado as Tab) : "activos";

  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/mis-anuncios");

  const [listings, usage, catalog, renewDays, t, tPrice, format] = await Promise.all([
    getMyListings(user.id),
    getPlanUsage(user.id),
    getCatalog(),
    getRenewWindowDays(),
    getTranslations("listings"),
    getTranslations("price"),
    getFormatter(),
  ]);

  const inTab = (name: Tab, listing: MyListing) =>
    (TABS[name] as readonly ListingStatus[]).includes(listing.status);
  const visible = listings.filter((l) => inTab(tab, l));
  const now = Date.now();

  const statusLine = (listing: MyListing) => {
    const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
    switch (listing.status) {
      case "draft":
        return t("mine.draft");
      case "under_review":
        return t("mine.underReview");
      case "blocked":
        return listing.moderation_reason
          ? t("mine.blocked", { reason: listing.moderation_reason })
          : t("mine.blockedNoReason");
      case "expired":
        return listing.expires_at ? t("mine.expiredOn", { date: date(listing.expires_at) }) : null;
      case "active":
        return listing.expires_at ? t("mine.expiresOn", { date: date(listing.expires_at) }) : null;
      default:
        return t(`status.${listing.status}`);
    }
  };

  const cityName = (id: number | null) => catalog.cities.find((c) => c.id === id)?.name ?? null;

  const price = (listing: MyListing) => {
    if (listing.price_xaf === null) return null;
    const category = catalog.categories.find((c) => c.id === listing.category_id);
    const amount = formatXaf(listing.price_xaf);
    return category?.price_period === "month" ? tPrice("perMonth", { price: amount }) : amount;
  };

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">{t("mine.title")}</h1>
          <p className="text-sm text-text-muted">
            {t("mine.usage", { active: usage.active, max: usage.maxActive })}
          </p>
        </div>
        <Link
          href="/publicar"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-extrabold text-text"
        >
          <PlusIcon className="size-5" />
          {t("mine.publish")}
        </Link>
      </header>

      {params.publicado ? <Alert tone="success">{t("mine.published")}</Alert> : null}
      {params.aviso === "borradores" ? <Alert tone="info">{t("mine.draftsLimit")}</Alert> : null}

      <nav aria-label={t("mine.title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(TABS) as Tab[]).map((name) => {
          const count = listings.filter((l) => inTab(name, l)).length;
          const active = name === tab;
          return (
            <Link
              key={name}
              href={`/mis-anuncios?estado=${name}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm ${
                active ? "bg-primary font-semibold text-white" : "border border-border text-text"
              }`}
            >
              {t(`mine.tabs.${name}`)} ({count})
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-8 text-center text-sm text-text-muted">
          {t(`mine.empty.${tab}`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((listing) => {
            const canRenew =
              listing.status === "expired" ||
              (listing.status === "active" &&
                listing.expires_at !== null &&
                Date.parse(listing.expires_at) - now <= renewDays * DAY_MS);
            const priceText = price(listing);
            return (
              <li key={listing.id} className="flex flex-col gap-3 py-4">
                <div className="flex gap-3">
                  <div className="size-20 shrink-0 overflow-hidden rounded-control bg-placeholder">
                    {listing.cover ? (
                      // biome-ignore lint/performance/noImgElement: miniatura ya comprimida (D-019).
                      <img
                        src={imageUrl(listing.cover.storage_path, listing.cover.format, "thumb")}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    {priceText ? (
                      <p className="font-display text-base font-extrabold text-primary">
                        {priceText}
                      </p>
                    ) : null}
                    {listing.status === "active" || listing.status === "sold" ? (
                      <Link
                        href={listingPath(listing.code, listing.title, cityName(listing.city_id))}
                        className="line-clamp-2 text-[15px] leading-snug text-primary underline"
                      >
                        {listing.title}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-[15px] leading-snug">
                        {listing.title ?? t("mine.untitled")}
                      </p>
                    )}
                    <p className="text-xs text-text-muted">{statusLine(listing)}</p>
                  </div>
                </div>
                <ListingRowActions id={listing.id} status={listing.status} canRenew={canRenew} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
