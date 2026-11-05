import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { ChevronRightIcon } from "@/components/icons";
import { getCatalog } from "@/lib/catalog";

// Todas las categorías con sus subcategorías: el «Ver todas» del inicio, que solo enseña 12 (D-077).
// Sin JavaScript: enlaces a /categoria/<slug>. Se cachea con el catálogo.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog.all");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/categorias" },
  };
}

export default async function CategoriesPage() {
  "use cache";
  cacheTag("catalog");
  cacheLife("days");

  const [catalog, t] = await Promise.all([getCatalog(), getTranslations("catalog.all")]);
  const roots = catalog.categories.filter((c) => c.parent_id === null);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <ul className="flex flex-col gap-5">
        {roots.map((root) => (
          <li key={root.id} className="flex flex-col gap-2">
            <h2>
              <Link href={`/categoria/${root.slug}`} className="flex min-h-12 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface text-primary">
                  <CategoryIcon name={root.icon} className="size-5" />
                </span>
                <span className="flex-1 text-[17px] font-extrabold">{root.name}</span>
                <ChevronRightIcon className="size-5 text-text-muted" />
              </Link>
            </h2>
            <ul className="flex flex-wrap gap-2">
              {catalog.categories
                .filter((c) => c.parent_id === root.id)
                .map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/categoria/${sub.slug}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-border px-3.5 text-sm"
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
