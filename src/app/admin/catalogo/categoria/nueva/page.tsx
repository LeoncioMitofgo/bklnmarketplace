import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { CategoryFields } from "@/components/admin/category-fields";
import { requireAdmin } from "@/lib/admin/auth";
import { saveCategory } from "@/lib/admin/catalog-actions";

// Nueva categoría principal, o subcategoría con ?padre=<id>. Al crearla se va a su ficha.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.category");
  return { title: t("newTitle") };
}

export default function NewCategoryPage({
  searchParams,
}: PageProps<"/admin/catalogo/categoria/nueva">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <NewCategory searchParams={searchParams} />
    </Suspense>
  );
}

async function NewCategory({
  searchParams,
}: Pick<PageProps<"/admin/catalogo/categoria/nueva">, "searchParams">) {
  const { padre } = await searchParams;
  const { supabase } = await requireAdmin("/admin/catalogo/categoria/nueva");
  const parentId = Number.parseInt(typeof padre === "string" ? padre : "", 10);
  const [{ data: parent }, t] = await Promise.all([
    Number.isInteger(parentId)
      ? supabase.from("categories").select("id, name, parent_id").eq("id", parentId).maybeSingle()
      : Promise.resolve({ data: null }),
    getTranslations("admin.category"),
  ]);
  // Solo dos niveles: dentro de una subcategoría no se crean más.
  const validParent = parent && parent.parent_id === null ? parent : null;

  return (
    <AdminShell active="catalog">
      <Link
        href={validParent ? `/admin/catalogo/categoria/${validParent.id}` : "/admin/catalogo"}
        className="-mb-2 text-sm font-semibold text-primary"
      >
        {t("back")}
      </Link>
      <h1 className="text-xl font-extrabold">
        {validParent ? t("newChild", { parent: validParent.name }) : t("newRoot")}
      </h1>
      <AdminActionForm
        action={saveCategory}
        pendingLabel={t("working")}
        buttons={[{ label: t("create") }]}
      >
        {validParent ? <input type="hidden" name="parentId" value={validParent.id} /> : null}
        <CategoryFields isRoot={!validParent} />
      </AdminActionForm>
    </AdminShell>
  );
}
