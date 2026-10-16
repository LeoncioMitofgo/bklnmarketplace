import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { PlusIcon } from "@/components/icons";
import { ListingCard, ListingRow } from "@/components/listings/listing-card";
import { SearchBar } from "@/components/search/search-bar";
import { buttonClasses } from "@/components/ui/button";
import { getCatalog } from "@/lib/catalog";
import { getFeaturedListings, getRecentListings } from "@/lib/listings/public";
import { LISTINGS_TAG } from "@/lib/listings/tags";

// Inicio (wireframe 01): buscador, categorías, destacados Premium y recientes, con "Ver más"
// en lugar de scroll infinito. Todo es público y se cachea: la página se sirve desde la CDN.

const HOME_CATEGORIES = 12;
const RECENT_LIMIT = 8;
const FEATURED_LIMIT = 10;

export default async function HomePage() {
  const tBrand = await getTranslations("brand");
  return (
    <main className="flex flex-col gap-7 pt-4">
      <header className="flex flex-col gap-3 px-4">
        <Logo label={tBrand("logoLabel")} />
        <SearchBar />
      </header>
      <Categories />
      <Listings />
    </main>
  );
}

async function Categories() {
  "use cache";
  cacheTag("catalog");
  cacheLife("days");

  const [catalog, t] = await Promise.all([getCatalog(), getTranslations("catalog")]);
  const roots = catalog.categories.filter((c) => c.parent_id === null).slice(0, HOME_CATEGORIES);
  const label = (slug: string, name: string) =>
    t.has(`shortNames.${slug}`) ? t(`shortNames.${slug}`) : name;

  return (
    <section className="flex flex-col gap-3 px-4">
      <SectionHeader title={t("home.categories")} href="/buscar" more={t("home.allCategories")} />
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
        {roots.map((category) => (
          <li key={category.id}>
            <Link
              href={`/categoria/${category.slug}`}
              className="flex min-h-11 flex-col items-center gap-1.5 text-center text-xs leading-tight"
            >
              <span className="flex size-12 items-center justify-center rounded-card bg-surface text-primary">
                <CategoryIcon name={category.icon} className="size-6" />
              </span>
              {label(category.slug, category.name)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Listings() {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");

  const [catalog, featured, recent, t] = await Promise.all([
    getCatalog(),
    getFeaturedListings(FEATURED_LIMIT),
    getRecentListings(RECENT_LIMIT),
    getTranslations("catalog.home"),
  ]);
  const now = Date.now();

  if (recent.length === 0) {
    return (
      <section className="mx-4 flex flex-col items-center gap-4 rounded-card bg-surface px-4 py-8 text-center">
        <p className="text-base">{t("empty")}</p>
        <Link
          href="/publicar"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 font-extrabold text-text"
        >
          <PlusIcon className="size-5" />
          {t("emptyCta")}
        </Link>
      </section>
    );
  }

  return (
    <>
      {featured.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="px-4">
            <SectionHeader title={t("featured")} href="/buscar" more={t("featuredMore")} />
          </div>
          <ul className="flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((listing) => (
              <li key={listing.id} className="w-40 shrink-0 snap-start">
                <ListingCard listing={listing} catalog={catalog} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-1 px-4">
        <h2 className="text-[17px] font-extrabold">{t("recent")}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {recent.map((listing) => (
            <li key={listing.id}>
              <ListingRow listing={listing} catalog={catalog} now={now} />
            </li>
          ))}
        </ul>
        <Link href="/buscar?orden=recientes" className={buttonClasses("secondary", "mt-2")}>
          {t("moreListings")}
        </Link>
      </section>
    </>
  );
}

function SectionHeader({ title, href, more }: { title: string; href: string; more: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-extrabold">{title}</h2>
      <Link href={href} className="py-2 text-sm font-semibold text-primary">
        {more}
      </Link>
    </div>
  );
}
