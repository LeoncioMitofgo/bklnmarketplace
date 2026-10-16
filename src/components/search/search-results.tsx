import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronDownIcon, CloseIcon, FiltersIcon } from "@/components/icons";
import { ListingRow } from "@/components/listings/listing-card";
import type { Catalog, Category } from "@/lib/catalog-types";
import { formatNumber, formatXaf } from "@/lib/format";
import { searchListings } from "@/lib/listings/public";
import {
  countActiveFilters,
  filterableAttributes,
  MAX_PAGES,
  PAGE_SIZE,
  type SearchFilters,
  SORTS,
  searchHref,
  toRpcArgs,
  toSearchParams,
} from "@/lib/search/params";
import { FiltersSheet } from "./filters-sheet";
import { SearchBar } from "./search-bar";

// Resultados de búsqueda (wireframe 02), compartidos por /buscar y /categoria/<slug>:
// filtros activos como chips que se quitan, orden, lista con miniatura y "Ver más" (D-041).

type Props = {
  filters: SearchFilters;
  catalog: Catalog;
  /** Ruta de la página: /buscar o /categoria/<slug> (en ese caso la categoría va en la ruta). */
  basePath: string;
  title?: string;
};

export async function SearchResults({ filters, catalog, basePath, title }: Props) {
  const omitCategory = basePath !== "/buscar";
  const [result, t, tSort] = await Promise.all([
    searchListings(toRpcArgs(filters)),
    getTranslations("catalog.search"),
    getTranslations("catalog.sort"),
  ]);
  const now = Date.now();

  const href = (next: Partial<SearchFilters>, path = basePath) =>
    searchHref(path, { ...filters, pages: 1, ...next }, catalog, {
      omitCategory: path !== "/buscar",
    });

  const keep = [...toSearchParams({ ...filters, q: "", pages: 1 }, catalog).entries()];
  const shown = result.cards.length;
  const canLoadMore = result.total > shown && filters.pages < MAX_PAGES;
  // En /categoria/<slug> la categoría es la página, no un filtro.
  const activeFilters = countActiveFilters(omitCategory ? { ...filters, category: null } : filters);

  return (
    <>
      <div className="flex flex-col gap-3 px-4">
        {title ? <h1 className="text-2xl font-extrabold">{title}</h1> : null}
        <SearchBar defaultValue={filters.q} keep={keep} />
      </div>

      <CategoryChips filters={filters} catalog={catalog} href={href} />

      <div className="-mt-1 flex gap-2 overflow-x-auto px-4 pb-1">
        <a
          href="#filtros"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary px-3.5 text-sm font-semibold text-primary"
        >
          <FiltersIcon className="size-4" />
          {activeFilters > 0 ? t("filtersCount", { count: activeFilters }) : t("filters")}
        </a>
        <ActiveChips filters={filters} catalog={catalog} href={href} omitCategory={omitCategory} />
      </div>

      <div id="resultados" className="flex scroll-mt-4 items-center justify-between gap-3 px-4">
        <p className="text-sm text-text-muted">{t("results", { count: result.total })}</p>
        {result.total > 1 ? (
          <details key={filters.sort} className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
              {tSort(filters.sort)}
              <ChevronDownIcon className="size-4" />
            </summary>
            <ul className="absolute right-0 z-10 mt-1 w-60 rounded-card border border-border bg-bg py-1">
              {SORTS.map((sort) => (
                <li key={sort}>
                  <Link
                    href={href({ sort })}
                    aria-current={sort === filters.sort ? "true" : undefined}
                    className={`flex min-h-11 items-center px-4 text-sm ${
                      sort === filters.sort ? "font-bold text-primary" : ""
                    }`}
                  >
                    {tSort(sort)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {shown === 0 ? (
        <div className="mx-4 flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-8 text-center">
          <p className="text-base font-semibold">{t("empty")}</p>
          <p className="text-sm text-text-muted">{t("emptyHint")}</p>
          {activeFilters > 0 || filters.q ? (
            <Link href="/buscar" className="py-2 text-sm font-semibold text-primary">
              {t("clear")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4">
          <ul className="flex flex-col divide-y divide-border">
            {result.cards.map((listing, index) => (
              <li key={listing.id}>
                <ListingRow id={`r${index + 1}`} listing={listing} catalog={catalog} now={now} />
              </li>
            ))}
          </ul>
          {canLoadMore ? (
            <Link
              href={`${href({ pages: filters.pages + 1 })}#r${shown + 1}`}
              className="flex min-h-[52px] items-center justify-center rounded-control border-2 border-primary text-base font-bold text-primary"
            >
              {t("more", { count: Math.min(PAGE_SIZE, result.total - shown) })}
            </Link>
          ) : result.total > shown ? (
            <p className="rounded-card bg-surface px-4 py-3 text-sm text-text-muted">
              {t("refine", { count: formatNumber(result.total) })}
            </p>
          ) : null}
        </div>
      )}

      <FiltersSheet
        key={toSearchParams(filters, catalog).toString()}
        filters={filters}
        catalog={catalog}
        clearHref={href({
          city: null,
          priceMin: null,
          priceMax: null,
          condition: null,
          attributes: {},
          ranges: {},
          category: omitCategory ? filters.category : null,
        })}
      />
    </>
  );
}

type HrefFn = (next: Partial<SearchFilters>, path?: string) => string;

/** Subcategorías de la categoría elegida o, sin categoría, las principales. */
async function CategoryChips({
  filters,
  catalog,
  href,
}: {
  filters: SearchFilters;
  catalog: Catalog;
  href: HrefFn;
}) {
  const t = await getTranslations("catalog.search");
  const current = filters.category;
  const parent = current?.parent_id
    ? catalog.categories.find((c) => c.id === current.parent_id)
    : current;
  const options = catalog.categories.filter((c) => c.parent_id === (parent?.id ?? null));
  const to = (category: Category) =>
    href({ category, attributes: {}, ranges: {} }, `/categoria/${category.slug}`);

  return (
    <nav aria-label={t("categories")} className="-mt-1 flex gap-2 overflow-x-auto px-4 pb-1">
      {parent ? (
        <Link
          href={to(parent)}
          aria-current={current?.id === parent.id ? "page" : undefined}
          className={chipClass(current?.id === parent.id)}
        >
          {t("allIn", { name: parent.name })}
        </Link>
      ) : null}
      {options.map((category) => (
        <Link
          key={category.id}
          href={to(category)}
          aria-current={current?.id === category.id ? "page" : undefined}
          className={chipClass(current?.id === category.id)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}

function chipClass(active: boolean) {
  return `inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm ${
    active ? "bg-primary font-semibold text-white" : "border border-border text-text"
  }`;
}

/** Chips de los filtros puestos; cada uno es un enlace a la misma búsqueda sin ese filtro. */
async function ActiveChips({
  filters,
  catalog,
  href,
  omitCategory,
}: {
  filters: SearchFilters;
  catalog: Catalog;
  href: HrefFn;
  omitCategory: boolean;
}) {
  const t = await getTranslations("catalog.search");
  const tFilters = await getTranslations("catalog.filters");
  const chips: { key: string; label: string; href: string }[] = [];

  if (filters.category && !omitCategory) {
    chips.push({
      key: "category",
      label: filters.category.name,
      href: href({ category: null, attributes: {}, ranges: {} }),
    });
  }
  if (filters.city) {
    chips.push({ key: "city", label: filters.city.name, href: href({ city: null }) });
  }
  if (filters.priceMin !== null || filters.priceMax !== null) {
    chips.push({
      key: "price",
      label: rangeLabel(filters.priceMin, filters.priceMax, formatXaf, t),
      href: href({ priceMin: null, priceMax: null }),
    });
  }
  if (filters.condition) {
    chips.push({
      key: "condition",
      label: tFilters(filters.condition === "new" ? "new" : "used"),
      href: href({ condition: null }),
    });
  }
  for (const attribute of filterableAttributes(catalog, filters.category)) {
    const value = filters.attributes[attribute.key];
    if (value !== undefined) {
      const { [attribute.key]: _, ...rest } = filters.attributes;
      chips.push({
        key: attribute.key,
        label: value === true ? attribute.label : String(value),
        href: href({ attributes: rest }),
      });
    }
    const range = filters.ranges[attribute.key];
    if (range) {
      const { [attribute.key]: _, ...rest } = filters.ranges;
      const unit = attribute.unit ? ` ${attribute.unit}` : "";
      chips.push({
        key: `${attribute.key}-range`,
        label: `${attribute.label}: ${rangeLabel(range[0], range[1], (n) => `${formatNumber(n)}${unit}`, t)}`,
        href: href({ ranges: rest }),
      });
    }
  }

  return chips.map((chip) => (
    <Link
      key={chip.key}
      href={chip.href}
      aria-label={t("removeFilter", { label: chip.label })}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm"
    >
      {chip.label}
      <CloseIcon className="size-4" />
    </Link>
  ));
}

function rangeLabel(
  min: number | null,
  max: number | null,
  format: (n: number) => string,
  t: (key: "rangeBoth" | "rangeFrom" | "rangeTo", values: Record<string, string>) => string,
) {
  if (min !== null && max !== null) return t("rangeBoth", { min: format(min), max: format(max) });
  if (min !== null) return t("rangeFrom", { min: format(min) });
  return t("rangeTo", { max: format(max ?? 0) });
}
