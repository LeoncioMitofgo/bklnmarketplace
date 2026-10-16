import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResultsSkeleton } from "@/components/search/results-skeleton";
import { SearchResults } from "@/components/search/search-results";
import { getCatalog } from "@/lib/catalog";
import { parseSearchParams } from "@/lib/search/params";

export async function generateMetadata({ searchParams }: PageProps<"/buscar">): Promise<Metadata> {
  const [{ q }, t] = await Promise.all([searchParams, getTranslations("catalog.search")]);
  const query = typeof q === "string" ? q.trim().slice(0, 60) : "";
  return {
    title: query ? t("metaTitleQuery", { q: query }) : t("metaTitle"),
    // Las páginas de resultados no se indexan; las de categoría, sí.
    robots: { index: false, follow: true },
  };
}

export default function SearchPage({ searchParams }: PageProps<"/buscar">) {
  return (
    <main className="flex flex-col gap-4 pt-4">
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchContent({ searchParams }: Pick<PageProps<"/buscar">, "searchParams">) {
  const [raw, catalog] = await Promise.all([searchParams, getCatalog()]);
  return (
    <SearchResults filters={parseSearchParams(raw, catalog)} catalog={catalog} basePath="/buscar" />
  );
}
