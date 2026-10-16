import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResultsSkeleton } from "@/components/search/results-skeleton";
import { SearchResults } from "@/components/search/search-results";
import { getCatalog } from "@/lib/catalog";
import { parseSearchParams } from "@/lib/search/params";

export async function generateMetadata({
  params,
}: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const [{ slug }, catalog, t] = await Promise.all([
    params,
    getCatalog(),
    getTranslations("catalog.category"),
  ]);
  const category = catalog.categories.find((c) => c.slug === slug);
  if (!category) return {};
  return {
    title: category.name,
    description: t("metaDescription", { name: category.name }),
    alternates: { canonical: `/categoria/${category.slug}` },
  };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/categoria/[slug]">) {
  return (
    <main className="flex flex-col gap-4 pt-4">
      <Suspense fallback={<ResultsSkeleton />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CategoryContent({
  params,
  searchParams,
}: Pick<PageProps<"/categoria/[slug]">, "params" | "searchParams">) {
  const [{ slug }, raw, catalog] = await Promise.all([params, searchParams, getCatalog()]);
  const category = catalog.categories.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <SearchResults
      filters={parseSearchParams(raw, catalog, category)}
      catalog={catalog}
      basePath={`/categoria/${category.slug}`}
      title={category.name}
    />
  );
}
