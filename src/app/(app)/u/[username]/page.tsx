import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClockIcon, MapPinIcon } from "@/components/icons";
import { ListingCard } from "@/components/listings/listing-card";
import { Avatar } from "@/components/profile/avatar";
import { getCatalog } from "@/lib/catalog";
import { responseTimeParts } from "@/lib/format";
import { getProfileListings } from "@/lib/listings/public";
import { getPublicProfile } from "@/lib/profiles";
import { MAX_PAGES, PAGE_SIZE } from "@/lib/search/params";

// Perfil público (ALCANCE §4.8): datos del vendedor, anuncios en venta y vendidos recientes.

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return {};
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio ?? undefined,
    alternates: { canonical: `/u/${profile.username}` },
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: PageProps<"/u/[username]">) {
  const t = await getTranslations("profile");
  return (
    <main className="flex flex-col gap-6 px-4 pt-6">
      <Suspense fallback={<p className="text-text-muted">{t("loading")}</p>}>
        <ProfileContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProfileContent({
  params,
  searchParams,
}: Pick<PageProps<"/u/[username]">, "params" | "searchParams">) {
  const [{ username }, { n }] = await Promise.all([params, searchParams]);
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) notFound();

  const requested = Number.parseInt(typeof n === "string" ? n : "", 10);
  const pages = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_PAGES) : 1;

  const [listings, catalog, t, format] = await Promise.all([
    getProfileListings(profile.id, pages * PAGE_SIZE),
    getCatalog(),
    getTranslations("profile"),
    getFormatter(),
  ]);
  const now = Date.now();
  const isPremium = profile.premium_until !== null && new Date(profile.premium_until) > new Date();
  const response =
    profile.response_time_minutes !== null
      ? responseTimeParts(profile.response_time_minutes)
      : null;
  const shown = listings.active.length;

  return (
    <>
      <section className="flex items-center gap-4">
        <Avatar name={profile.display_name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{profile.display_name}</h1>
            {isPremium ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
                {t("premium")}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-text-muted">@{profile.username}</p>
        </div>
      </section>

      <div className="flex flex-col gap-1.5 text-sm text-text-muted">
        {profile.city ? (
          <span className="flex items-center gap-1.5">
            <MapPinIcon className="size-4" />
            {profile.city.name}
          </span>
        ) : null}
        {response ? (
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-4" />
            {t("responds", {
              time: t(`responseTime.${response.unit}`, { count: response.count }),
            })}
          </span>
        ) : null}
        <span>
          {t("memberSince", {
            date: format.dateTime(new Date(profile.created_at), { month: "long", year: "numeric" }),
          })}
        </span>
      </div>

      {profile.bio ? <p className="text-base leading-relaxed">{profile.bio}</p> : null}

      <section className="flex flex-col gap-4 border-t border-border pt-5">
        <h2 className="text-lg font-extrabold">{t("onSale", { count: listings.activeTotal })}</h2>
        {shown === 0 ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            {t("noListings", { name: profile.display_name })}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
            {listings.active.map((listing, index) => (
              <li key={listing.id} id={`a${index + 1}`} className="scroll-mt-4">
                <ListingCard listing={listing} catalog={catalog} now={now} />
              </li>
            ))}
          </ul>
        )}
        {listings.activeTotal > shown && pages < MAX_PAGES ? (
          <Link
            href={`/u/${profile.username}?n=${pages + 1}#a${shown + 1}`}
            className="flex min-h-[52px] items-center justify-center rounded-control border-2 border-primary text-base font-bold text-primary"
          >
            {t("more")}
          </Link>
        ) : null}
      </section>

      {listings.sold.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-border pt-5">
          <h2 className="text-lg font-extrabold">{t("soldRecently")}</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
            {listings.sold.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} catalog={catalog} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
