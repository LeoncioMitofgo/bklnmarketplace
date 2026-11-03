import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClockIcon, MapPinIcon } from "@/components/icons";
import { ListingCard } from "@/components/listings/listing-card";
import { ShareButton } from "@/components/listings/share-button";
import { WhatsAppButton } from "@/components/listings/whatsapp-button";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { responseTimeParts } from "@/lib/format";
import { getProfileListings } from "@/lib/listings/public";
import { profileMediaUrl } from "@/lib/profile-media";
import { MAX_PAGES, PAGE_SIZE } from "@/lib/search/params";
import { siteUrl } from "@/lib/site";
import { openStoreWhatsApp } from "@/lib/stores/actions";
import { getPublicStore, type PublicStore } from "@/lib/stores/public";
import { STORE_SLUG_PATTERN } from "@/lib/stores/slug";
import { createClient } from "@/lib/supabase/server";

// Tienda Premium (wireframe 05, ALCANCE §4.8): portada, logo, horario, dirección y pestañas
// "En venta" / "Vendidos". Pública, cacheada e indexable; el WhatsApp va en su <Suspense>.

async function load(slug: string) {
  return STORE_SLUG_PATTERN.test(slug) ? getPublicStore(slug) : null;
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [store, t] = await Promise.all([load(slug), getTranslations("store.page")]);
  if (!store) return { robots: { index: false } };
  const description =
    store.description?.slice(0, 200) ?? t("metaDescription", { name: store.name });
  const image = store.cover_path ?? store.logo_path;
  return {
    title: store.name,
    description,
    alternates: { canonical: `/t/${store.slug}` },
    openGraph: {
      type: "website",
      url: `/t/${store.slug}`,
      title: store.name,
      description,
      images: image ? [{ url: profileMediaUrl(image), alt: store.name }] : undefined,
    },
  };
}

export default function StorePage({ params, searchParams }: PageProps<"/t/[slug]">) {
  return (
    <main className="flex flex-col pb-6">
      <Suspense fallback={<div className="aspect-[3/1] bg-placeholder" aria-hidden="true" />}>
        <StoreContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StoreContent({
  params,
  searchParams,
}: Pick<PageProps<"/t/[slug]">, "params" | "searchParams">) {
  const [{ slug }, { n, ver }] = await Promise.all([params, searchParams]);
  const store = await load(slug);
  if (!store) notFound();

  const requested = Number.parseInt(typeof n === "string" ? n : "", 10);
  const pages = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_PAGES) : 1;
  const showSold = ver === "vendidos";

  const [listings, catalog, t, format] = await Promise.all([
    getProfileListings(store.user_id, pages * PAGE_SIZE),
    getCatalog(),
    getTranslations("store.page"),
    getFormatter(),
  ]);
  const { owner } = store;
  const response =
    owner.response_time_minutes !== null ? responseTimeParts(owner.response_time_minutes) : null;
  const shown = showSold ? listings.sold : listings.active;
  const base = `/t/${store.slug}`;

  return (
    <>
      {store.cover_path ? (
        // biome-ignore lint/performance/noImgElement: fotos ya reducidas en el móvil (ARQUITECTURA §5.2).
        <img
          src={profileMediaUrl(store.cover_path)}
          alt=""
          className="aspect-[3/1] w-full bg-placeholder object-cover"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[3/1] w-full bg-primary" />
      )}

      <div className="flex flex-col gap-5 px-4">
        <section className="-mt-10 flex items-end gap-3">
          {store.logo_path ? (
            // biome-ignore lint/performance/noImgElement: fotos ya reducidas en el móvil.
            <img
              src={profileMediaUrl(store.logo_path)}
              alt=""
              width={80}
              height={80}
              className="size-20 shrink-0 rounded-card border-4 border-bg bg-surface object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-card border-4 border-bg bg-surface font-display text-3xl font-extrabold text-primary"
            >
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex min-w-0 flex-1 items-center justify-end">
            <ShareButton
              url={`${siteUrl()}${base}`}
              text={t("shareText", { name: store.name })}
              label={t("share")}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-text"
            />
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            {store.name}
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
              {t("premium")}
            </span>
          </h1>
          <Link href={`/u/${owner.username}`} className="text-sm text-text-muted">
            {t("by", { name: owner.display_name, username: owner.username })}
          </Link>
          <ul className="flex flex-col gap-1.5 pt-1 text-sm text-text-muted">
            {store.address || owner.city ? (
              <li className="flex items-start gap-1.5">
                <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                {[store.address, owner.city?.name].filter(Boolean).join(" · ")}
              </li>
            ) : null}
            {store.opening_hours ? (
              <li className="flex items-start gap-1.5">
                <ClockIcon className="mt-0.5 size-4 shrink-0" />
                {store.opening_hours}
              </li>
            ) : null}
            {response ? (
              <li>
                {t("responds", {
                  time: t(`responseTime.${response.unit}`, { count: response.count }),
                })}
              </li>
            ) : null}
            <li>
              {t("memberSince", {
                date: format.dateTime(new Date(owner.created_at), {
                  month: "long",
                  year: "numeric",
                }),
              })}
            </li>
          </ul>
        </section>

        {store.description ? (
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">
            {store.description}
          </p>
        ) : null}

        <Suspense fallback={null}>
          <StoreWhatsApp store={store} />
        </Suspense>

        <nav aria-label={t("tabs")} className="flex border-b border-border">
          <Tab
            href={base}
            active={!showSold}
            label={t("onSale", { count: listings.activeTotal })}
          />
          <Tab href={`${base}?ver=vendidos`} active={showSold} label={t("sold")} />
        </nav>

        {shown.length === 0 ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            {showSold ? t("noSold") : t("noListings")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
            {shown.map((listing, index) => (
              <li key={listing.id} id={`a${index + 1}`} className="scroll-mt-4">
                <ListingCard
                  listing={listing}
                  catalog={catalog}
                  now={listings.fetchedAt}
                  hidePremium
                />
              </li>
            ))}
          </ul>
        )}
        {!showSold && listings.activeTotal > shown.length && pages < MAX_PAGES ? (
          <Link
            href={`${base}?n=${pages + 1}#a${shown.length + 1}`}
            className="flex min-h-[52px] items-center justify-center rounded-control border-2 border-primary text-base font-bold text-primary"
          >
            {t("more")}
          </Link>
        ) : null}
      </div>
    </>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm ${
        active ? "border-primary font-bold text-primary" : "border-transparent text-text-muted"
      }`}
    >
      {label}
    </Link>
  );
}

/** WhatsApp de la tienda: solo con sesión y si el dueño lo activó (ALCANCE §5.4). */
async function StoreWhatsApp({ store }: { store: PublicStore }) {
  const user = await getSessionUser();
  if (!user || user.id === store.user_id) return null;
  const supabase = await createClient();
  const [{ data: enabled }, messages] = await Promise.all([
    supabase.rpc("store_whatsapp_enabled", { p_user_id: store.user_id }),
    pickMessages(["chat.contact", "chat.errors"]),
  ]);
  if (!enabled) return null;
  return (
    <div className="flex">
      <NextIntlClientProvider messages={messages}>
        <WhatsAppButton action={openStoreWhatsApp} fields={{ slug: store.slug }} />
      </NextIntlClientProvider>
    </div>
  );
}
