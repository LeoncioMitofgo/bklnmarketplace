import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { AdminCheckbox, AdminInput } from "@/components/admin/fields";
import { requireAdmin } from "@/lib/admin/auth";
import { saveCity } from "@/lib/admin/catalog-actions";

// Una ciudad (ALCANCE §5.6: lista editable). No se borra, porque la usan anuncios y perfiles.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("cityTitle") };
}

export default function CityPage({ params }: PageProps<"/admin/catalogo/ciudad/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <CityContent params={params} />
    </Suspense>
  );
}

async function CityContent({ params }: Pick<PageProps<"/admin/catalogo/ciudad/[id]">, "params">) {
  const { id: rawId } = await params;
  const { supabase } = await requireAdmin(`/admin/catalogo/ciudad/${rawId}`);
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id)) notFound();
  const [{ data: city }, t] = await Promise.all([
    supabase
      .from("cities")
      .select("id, slug, name, sort_order, is_active")
      .eq("id", id)
      .maybeSingle(),
    getTranslations("admin.catalog"),
  ]);
  if (!city) notFound();

  return (
    <AdminShell active="catalog">
      <Link href="/admin/catalogo" className="-mb-2 text-sm font-semibold text-primary">
        {t("back")}
      </Link>
      <h1 className="text-xl font-extrabold">{city.name}</h1>
      <p className="text-sm text-text-muted">{t("citySlug", { slug: city.slug })}</p>
      <AdminActionForm
        action={saveCity}
        pendingLabel={t("working")}
        buttons={[{ label: t("save") }]}
      >
        <input type="hidden" name="id" value={city.id} />
        <AdminInput
          id="city-name"
          name="name"
          label={t("cityName")}
          required
          maxLength={60}
          defaultValue={city.name}
        />
        <AdminInput
          id="city-order"
          name="sortOrder"
          label={t("sortOrder")}
          inputMode="numeric"
          defaultValue={city.sort_order}
        />
        <AdminCheckbox
          id="city-active"
          name="isActive"
          label={t("cityActive")}
          defaultChecked={city.is_active}
        />
      </AdminActionForm>
    </AdminShell>
  );
}
