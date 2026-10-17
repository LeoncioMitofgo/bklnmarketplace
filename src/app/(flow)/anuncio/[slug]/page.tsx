import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ChevronRightIcon, ClockIcon, EyeIcon, HeartIcon, MapPinIcon } from "@/components/icons";
import { ContactBar } from "@/components/listings/contact-bar";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { Gallery } from "@/components/listings/gallery";
import { ListingCard } from "@/components/listings/listing-card";
import { SafetyTips } from "@/components/listings/safety-tips";
import { ShareButton } from "@/components/listings/share-button";
import { ViewTracker } from "@/components/listings/view-tracker";
import { BackButton } from "@/components/nav/back-button";
import { Avatar } from "@/components/profile/avatar";
import { getSessionUser } from "@/lib/auth/session";
import { attributesFor, type Catalog, getCatalog } from "@/lib/catalog";
import { isFavorite } from "@/lib/favorites/queries";
import { responseTimeParts } from "@/lib/format";
import { attributeText } from "@/lib/listings/attributes";
import { imageUrl } from "@/lib/listings/images";
import { listingPath, parseListingCode } from "@/lib/listings/paths";
import { priceLabel } from "@/lib/listings/price";
import { getPublicListing, getSimilarListings, type PublicListing } from "@/lib/listings/public";
import { siteUrl } from "@/lib/site";

// Ficha de anuncio (wireframe 04), a pantalla completa con la barra de contacto abajo.
// Pública y cacheada; lo que depende de la sesión (favorito, WhatsApp) va en su propio <Suspense>.

const SIMILAR_LIMIT = 6;
const overlayButton =
  "flex size-11 items-center justify-center rounded-full bg-bg/90 text-text focus-visible:outline-2 focus-visible:outline-primary";

async function load(slug: string) {
  const code = parseListingCode(slug);
  if (!code) return null;
  const [listing, catalog] = await Promise.all([getPublicListing(code), getCatalog()]);
  if (!listing) return null;
  const city = catalog.cities.find((c) => c.id === listing.city_id)?.name ?? null;
  const category = catalog.categories.find((c) => c.id === listing.category_id);
  return { listing, catalog, city, category, path: listingPath(code, listing.title, city) };
}

export async function generateMetadata({
  params,
}: PageProps<"/anuncio/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [data, tPrice] = await Promise.all([load(slug), getTranslations("price")]);
  if (!data) return { robots: { index: false } };

  const { listing, city, category, path } = data;
  const price = priceLabel(listing.price_xaf, category, tPrice);
  const place = [listing.neighborhood, city].filter(Boolean).join(", ");
  const title = `${listing.title} · ${price}`;
  const description = `${price} · ${place}. ${listing.description ?? ""}`.slice(0, 200);
  const cover = listing.images[0];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description,
      images: cover
        ? [
            {
              url: imageUrl(cover.storage_path, cover.format, "large"),
              width: cover.width,
              height: cover.height,
              alt: listing.title ?? "",
            },
          ]
        : undefined,
    },
  };
}

export default function ListingPage({ params }: PageProps<"/anuncio/[slug]">) {
  return (
    <main className="flex flex-col pb-28">
      <Suspense fallback={<ListingSkeleton />}>
        <ListingContent params={params} />
      </Suspense>
    </main>
  );
}

function ListingSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="aspect-[4/3] bg-placeholder" />
      <div className="flex flex-col gap-3 px-4">
        <div className="h-7 w-40 rounded bg-placeholder" />
        <div className="h-5 w-full rounded bg-surface" />
        <div className="h-4 w-48 rounded bg-surface" />
      </div>
    </div>
  );
}

async function ListingContent({ params }: Pick<PageProps<"/anuncio/[slug]">, "params">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { listing, catalog, city, category, path } = data;
  if (`/anuncio/${slug}` !== path) permanentRedirect(path);

  const [t, tPrice, tCard, tDetails, format] = await Promise.all([
    getTranslations("catalog.listing"),
    getTranslations("price"),
    getTranslations("catalog.card"),
    getTranslations("listings.details"),
    getFormatter(),
  ]);
  const now = listing.fetchedAt;
  const title = listing.title ?? "";
  const price = priceLabel(listing.price_xaf, category, tPrice);
  const place = [listing.neighborhood, city].filter(Boolean).join(", ");
  const parent = catalog.categories.find((c) => c.id === category?.parent_id);
  const defs = attributesFor(catalog, listing.category_id).filter(
    (d) => listing.attributes[d.key] !== undefined,
  );
  const url = `${siteUrl()}${path}`;

  return (
    <>
      <div className="relative">
        <Gallery
          images={listing.images}
          alt={title}
          counter={(current, total) => t("photoCount", { current, total })}
        />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <BackButton
            fallbackHref={category ? `/categoria/${category.slug}` : "/"}
            label={t("back")}
            className={overlayButton}
          />
          <div className="flex gap-2">
            <ShareButton
              url={url}
              text={t("shareText", { title })}
              label={t("share")}
              className={overlayButton}
            />
            <Suspense
              fallback={
                <span className={overlayButton}>
                  <HeartIcon className="size-5" />
                </span>
              }
            >
              <FavoriteSlot listingId={listing.id} returnTo={path} className={overlayButton} />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4">
        {listing.status === "sold" ? (
          <p className="rounded-card bg-text px-4 py-3 text-sm font-semibold text-white">
            {t("soldBanner")}
          </p>
        ) : null}

        <section className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-[26px] font-extrabold leading-tight text-primary">
              {price}
            </span>
            {listing.is_negotiable && listing.price_xaf !== null ? (
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-primary">
                {tCard("negotiable")}
              </span>
            ) : null}
          </p>
          <h1 className="text-xl font-extrabold leading-snug">{title}</h1>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
            {place ? (
              <li className="flex items-center gap-1.5">
                <MapPinIcon className="size-4" />
                {place}
              </li>
            ) : null}
            {listing.published_at ? (
              <li className="flex items-center gap-1.5">
                <ClockIcon className="size-4" />
                {format.relativeTime(new Date(listing.published_at), { now, style: "short" })}
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <EyeIcon className="size-4" />
              {t("views", { count: listing.view_count })}
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">{t("details")}</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-card border border-border p-4 text-sm">
            {listing.condition ? (
              <Detail label={t("condition")} value={tDetails(listing.condition)} />
            ) : null}
            {defs.map((d) => (
              <Detail
                key={d.key}
                label={d.label}
                value={attributeText(d, listing.attributes[d.key], { yes: t("yes"), no: t("no") })}
              />
            ))}
            {category ? (
              <Detail
                label={t("category")}
                value={
                  <Link href={`/categoria/${category.slug}`} className="text-primary underline">
                    {parent ? `${parent.name} › ${category.name}` : category.name}
                  </Link>
                }
              />
            ) : null}
          </dl>
        </section>

        {listing.description ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[17px] font-extrabold">{t("description")}</h2>
            <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">
              {listing.description}
            </p>
          </section>
        ) : null}

        <SellerCard seller={listing.seller} now={now} />
        <SafetyTips />

        {listing.status === "active" && listing.category_id !== null ? (
          <Suspense fallback={null}>
            <Similar
              categoryId={listing.category_id}
              excludeId={listing.id}
              catalog={catalog}
              now={now}
            />
          </Suspense>
        ) : null}
      </div>

      {listing.status === "active" ? (
        <>
          <ViewTracker listingId={listing.id} />
          <ContactBar listingId={listing.id} code={listing.code} sellerId={listing.user_id} />
        </>
      ) : null}
      <ProductJsonLd listing={listing} url={url} categoryName={category?.name} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

async function FavoriteSlot({
  listingId,
  returnTo,
  className,
}: {
  listingId: string;
  returnTo: string;
  className: string;
}) {
  const [user, t] = await Promise.all([getSessionUser(), getTranslations("catalog.listing")]);
  const saved = user ? await isFavorite(listingId) : false;
  return (
    <FavoriteButton
      listingId={listingId}
      returnTo={returnTo}
      saved={saved}
      labels={{ save: t("favorite"), remove: t("unfavorite") }}
      className={className}
    />
  );
}

async function SellerCard({ seller, now }: { seller: PublicListing["seller"]; now: number }) {
  const [t, tCard, format] = await Promise.all([
    getTranslations("catalog.listing.seller"),
    getTranslations("catalog.card"),
    getFormatter(),
  ]);
  const isPremium = seller.premium_until !== null && Date.parse(seller.premium_until) > now;
  const response =
    seller.response_time_minutes !== null ? responseTimeParts(seller.response_time_minutes) : null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border p-4">
      <div className="flex items-center gap-3">
        <Avatar name={seller.display_name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold">{seller.display_name}</span>
            {isPremium ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
                {tCard("premium")}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-text-muted">
            {t("memberSince", {
              date: format.dateTime(new Date(seller.created_at), {
                month: "long",
                year: "numeric",
              }),
            })}
          </p>
          {response ? (
            <p className="text-sm text-text-muted">
              {t("responds", {
                time: t(`responseTime.${response.unit}`, { count: response.count }),
              })}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={`/u/${seller.username}`}
        className="flex min-h-11 items-center justify-between rounded-control bg-surface px-4 text-sm font-semibold text-primary"
      >
        {t("viewProfile", { count: seller.activeListings })}
        <ChevronRightIcon className="size-5" />
      </Link>
    </section>
  );
}

async function Similar({
  categoryId,
  excludeId,
  catalog,
  now,
}: {
  categoryId: number;
  excludeId: string;
  catalog: Catalog;
  now: number;
}) {
  const [similar, t] = await Promise.all([
    getSimilarListings(categoryId, excludeId, SIMILAR_LIMIT),
    getTranslations("catalog.listing"),
  ]);
  if (similar.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-extrabold">{t("similar")}</h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
        {similar.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} catalog={catalog} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Datos estructurados Product/Offer para buscadores (ALCANCE §7). Sin teléfono ni email. */
function ProductJsonLd({
  listing,
  url,
  categoryName,
}: {
  listing: PublicListing;
  url: string;
  categoryName?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    sku: listing.code,
    category: categoryName,
    image: listing.images.map((i) => imageUrl(i.storage_path, i.format, "large")),
    offers:
      listing.price_xaf !== null
        ? {
            "@type": "Offer",
            url,
            price: listing.price_xaf,
            priceCurrency: "XAF",
            availability:
              listing.status === "sold"
                ? "https://schema.org/SoldOut"
                : "https://schema.org/InStock",
            itemCondition:
              listing.condition === "new"
                ? "https://schema.org/NewCondition"
                : listing.condition === "used"
                  ? "https://schema.org/UsedCondition"
                  : undefined,
          }
        : undefined,
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD escapado (sin "<").
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
