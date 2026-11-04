import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { AdminInput } from "@/components/admin/fields";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { ChevronRightIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { saveCity } from "@/lib/admin/catalog-actions";

// Catálogo (ALCANCE §4.11): categorías con sus subcategorías y ciudades. Incluye las desactivadas.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("title") };
}

export default function AdminCatalogPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminCatalog />
    </Suspense>
  );
}

async function AdminCatalog() {
  const { supabase } = await requireAdmin("/admin/catalogo");
  const [categories, cities, t] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name, icon, is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("cities")
      .select("id, name, sort_order, is_active")
      .order("sort_order")
      .order("name"),
    getTranslations("admin.catalog"),
  ]);
  if (categories.error || cities.error) {
    throw new Error(`admin_catalog: ${categories.error?.message ?? cities.error?.message}`);
  }
  const roots = categories.data.filter((c) => c.parent_id === null);
  const childrenOf = (id: number) => categories.data.filter((c) => c.parent_id === id);
  const inactive = <span className="text-xs font-semibold text-danger">{t("inactive")}</span>;

  return (
    <AdminShell active="catalog">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold">{t("categories")}</h1>
          <Link
            href="/admin/catalogo/categoria/nueva"
            className="text-sm font-semibold text-primary"
          >
            {t("newRoot")}
          </Link>
        </div>
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-3">
          {roots.map((root) => (
            <li key={root.id} className="rounded-card border border-border">
              <Link
                href={`/admin/catalogo/categoria/${root.id}`}
                className="flex min-h-12 items-center gap-3 px-4 font-bold hover:bg-surface"
              >
                <CategoryIcon name={root.icon} className="size-5 shrink-0 text-primary" />
                <span className="flex-1">{root.name}</span>
                {root.is_active ? null : inactive}
                <ChevronRightIcon className="size-5 text-text-muted" />
              </Link>
              <ul className="flex flex-col border-t border-border px-4 py-1 text-sm">
                {childrenOf(root.id).map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/admin/catalogo/categoria/${child.id}`}
                      className="flex min-h-10 items-center justify-between gap-2"
                    >
                      <span className={child.is_active ? "" : "text-text-muted line-through"}>
                        {child.name}
                      </span>
                      {child.is_active ? null : inactive}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 lg:max-w-xl">
        <h2 className="text-lg font-extrabold">{t("cities")}</h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border text-sm">
          {cities.data.map((city) => (
            <li key={city.id}>
              <Link
                href={`/admin/catalogo/ciudad/${city.id}`}
                className="flex min-h-11 items-center justify-between gap-2 px-4"
              >
                <span className={city.is_active ? "" : "text-text-muted line-through"}>
                  {city.name}
                </span>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  {city.is_active ? null : inactive}
                  {t("order", { order: city.sort_order })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="rounded-card bg-surface p-4">
          <AdminActionForm
            action={saveCity}
            pendingLabel={t("working")}
            buttons={[{ label: t("addCity"), variant: "secondary" }]}
          >
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <AdminInput
                id="new-city-name"
                name="name"
                label={t("cityName")}
                required
                maxLength={60}
              />
              <AdminInput
                id="new-city-order"
                name="sortOrder"
                label={t("sortOrder")}
                inputMode="numeric"
                defaultValue={cities.data.length + 1}
              />
            </div>
          </AdminActionForm>
        </div>
      </section>
      <Link
        href="/admin/ajustes"
        className={buttonClasses("ghost", "lg:w-auto lg:self-start lg:px-0")}
      >
        {t("toSettings")}
      </Link>
    </AdminShell>
  );
}
