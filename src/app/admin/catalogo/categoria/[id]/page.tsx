import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import {
  AdminColumn,
  AdminColumns,
  AdminShell,
  AdminSkeleton,
} from "@/components/admin/admin-shell";
import { CategoryFields } from "@/components/admin/category-fields";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextArea } from "@/components/admin/fields";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteAttribute, saveAttribute, saveCategory } from "@/lib/admin/catalog-actions";

// Ficha de una categoría: sus datos, sus subcategorías (si es principal) y sus atributos. Los
// atributos de una principal los heredan todas sus subcategorías.

type Attribute = {
  id: number;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options: unknown;
  unit: string | null;
  is_required: boolean;
  is_filterable: boolean;
  sort_order: number;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.category");
  return { title: t("title") };
}

export default function CategoryPage({ params }: PageProps<"/admin/catalogo/categoria/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({
  params,
}: Pick<PageProps<"/admin/catalogo/categoria/[id]">, "params">) {
  const { id: rawId } = await params;
  const { supabase } = await requireAdmin(`/admin/catalogo/categoria/${rawId}`);
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id)) notFound();

  const [{ data: category }, { data: children }, { data: attributes }, t] = await Promise.all([
    supabase
      .from("categories")
      .select(
        "id, parent_id, name, slug, icon, price_required, price_period, has_condition, sort_order, is_active",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, is_active")
      .eq("parent_id", id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("category_attributes")
      .select("id, key, label, type, options, unit, is_required, is_filterable, sort_order")
      .eq("category_id", id)
      .order("sort_order"),
    getTranslations("admin.category"),
  ]);
  if (!category) notFound();
  const isRoot = category.parent_id === null;
  const { data: parent } =
    category.parent_id === null
      ? { data: null }
      : await supabase.from("categories").select("id, name").eq("id", category.parent_id).single();

  return (
    <AdminShell active="catalog">
      <Link
        href={parent ? `/admin/catalogo/categoria/${parent.id}` : "/admin/catalogo"}
        className="-mb-2 text-sm font-semibold text-primary"
      >
        {parent ? t("backTo", { name: parent.name }) : t("back")}
      </Link>
      <h1 className="text-xl font-extrabold">{category.name}</h1>
      <AdminColumns>
        <AdminColumn>
          <AdminActionForm
            action={saveCategory}
            pendingLabel={t("working")}
            buttons={[{ label: t("save") }]}
          >
            <input type="hidden" name="id" value={category.id} />
            <CategoryFields category={category} isRoot={isRoot} />
          </AdminActionForm>
        </AdminColumn>

        <AdminColumn>
          {isRoot ? (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold">{t("children")}</h2>
                <Link
                  href={`/admin/catalogo/categoria/nueva?padre=${category.id}`}
                  className="text-sm font-semibold text-primary"
                >
                  {t("newChildLink")}
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-card border border-border text-sm">
                {(children ?? []).map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/admin/catalogo/categoria/${child.id}`}
                      className="flex min-h-11 items-center px-4"
                    >
                      <span className={child.is_active ? "" : "text-text-muted line-through"}>
                        {child.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">{t("attributes")}</h2>
            <p className="text-sm text-text-muted">
              {isRoot ? t("attributesRootHint") : t("attributesHint")}
            </p>
            {(attributes ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">{t("noAttributes")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(attributes as Attribute[]).map((attribute) => (
                  <li key={attribute.id}>
                    <details className="rounded-card border border-border">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 [&::-webkit-details-marker]:hidden">
                        <span className="font-semibold">{attribute.label}</span>
                        <span className="text-xs text-text-muted">
                          {attribute.key} · {t(`types.${attribute.type}`)}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-3 border-t border-border p-4">
                        <AdminActionForm
                          action={saveAttribute}
                          pendingLabel={t("working")}
                          buttons={[{ label: t("save") }]}
                        >
                          <input type="hidden" name="id" value={attribute.id} />
                          <AttributeFields attribute={attribute} />
                        </AdminActionForm>
                        <AdminActionForm
                          action={deleteAttribute}
                          pendingLabel={t("working")}
                          buttons={[{ label: t("deleteAttribute"), variant: "ghost" }]}
                        >
                          <input type="hidden" name="id" value={attribute.id} />
                          <p className="text-xs text-text-muted">{t("deleteHint")}</p>
                        </AdminActionForm>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
              <h3 className="font-sans text-base font-bold">{t("newAttribute")}</h3>
              <AdminActionForm
                action={saveAttribute}
                pendingLabel={t("working")}
                buttons={[{ label: t("addAttribute"), variant: "secondary" }]}
              >
                <input type="hidden" name="categoryId" value={category.id} />
                <AttributeFields />
              </AdminActionForm>
            </div>
          </section>
        </AdminColumn>
      </AdminColumns>
    </AdminShell>
  );
}

/** Campos de un atributo. Al editarlo, la clave y el tipo ya no se pueden cambiar. */
async function AttributeFields({ attribute }: { attribute?: Attribute }) {
  const t = await getTranslations("admin.category");
  const prefix = attribute ? `attribute-${attribute.id}` : "attribute-new";
  const options = Array.isArray(attribute?.options)
    ? (attribute.options as string[]).join("\n")
    : "";
  return (
    <>
      <AdminInput
        id={`${prefix}-label`}
        name="label"
        label={t("label")}
        required
        maxLength={60}
        defaultValue={attribute?.label}
      />
      {attribute ? null : (
        <div className="grid grid-cols-2 gap-3">
          <AdminInput
            id={`${prefix}-key`}
            name="key"
            label={t("key")}
            hint={t("keyHint")}
            required
            maxLength={40}
            autoCapitalize="none"
          />
          <AdminSelect
            id={`${prefix}-type`}
            name="type"
            label={t("type")}
            defaultValue="select"
            options={(["select", "text", "number", "boolean"] as const).map((type) => ({
              value: type,
              label: t(`types.${type}`),
            }))}
          />
        </div>
      )}
      {!attribute || attribute.type === "select" ? (
        <AdminTextArea
          id={`${prefix}-options`}
          name="options"
          label={t("options")}
          hint={t("optionsHint")}
          rows={4}
          defaultValue={options}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {!attribute || attribute.type === "number" ? (
          <AdminInput
            id={`${prefix}-unit`}
            name="unit"
            label={t("unit")}
            hint={t("unitHint")}
            maxLength={20}
            defaultValue={attribute?.unit ?? ""}
          />
        ) : null}
        <AdminInput
          id={`${prefix}-order`}
          name="sortOrder"
          label={t("sortOrder")}
          inputMode="numeric"
          defaultValue={attribute?.sort_order ?? 0}
        />
      </div>
      <AdminCheckbox
        id={`${prefix}-required`}
        name="isRequired"
        label={t("required")}
        defaultChecked={attribute?.is_required ?? false}
      />
      <AdminCheckbox
        id={`${prefix}-filterable`}
        name="isFilterable"
        label={t("filterable")}
        defaultChecked={attribute?.is_filterable ?? false}
      />
    </>
  );
}
