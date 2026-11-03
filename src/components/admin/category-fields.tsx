import { getTranslations } from "next-intl/server";
import { CATEGORY_ICON_NAMES } from "@/components/catalog/category-icon";
import { AdminCheckbox, AdminInput, AdminSelect } from "./fields";

type Category = {
  name: string;
  slug: string;
  icon: string | null;
  price_required: boolean;
  price_period: "total" | "month";
  has_condition: boolean;
  sort_order: number;
  is_active: boolean;
};

/** Campos de una categoría (crear o editar). El icono solo lo llevan las principales. */
export async function CategoryFields({
  category,
  isRoot,
}: {
  category?: Category;
  isRoot: boolean;
}) {
  const t = await getTranslations("admin.category");
  return (
    <>
      <AdminInput
        id="category-name"
        name="name"
        label={t("name")}
        required
        maxLength={60}
        defaultValue={category?.name}
      />
      <AdminInput
        id="category-slug"
        name="slug"
        label={t("slug")}
        hint={category ? t("slugHintEdit") : t("slugHintNew")}
        maxLength={60}
        autoCapitalize="none"
        defaultValue={category?.slug}
      />
      <div className="grid grid-cols-2 gap-3">
        {isRoot ? (
          <AdminSelect
            id="category-icon"
            name="icon"
            label={t("icon")}
            defaultValue={category?.icon ?? "package"}
            options={CATEGORY_ICON_NAMES.map((name) => ({ value: name, label: name }))}
          />
        ) : null}
        <AdminInput
          id="category-order"
          name="sortOrder"
          label={t("sortOrder")}
          inputMode="numeric"
          defaultValue={category?.sort_order ?? 0}
        />
      </div>
      <AdminSelect
        id="category-period"
        name="pricePeriod"
        label={t("pricePeriod")}
        defaultValue={category?.price_period ?? "total"}
        options={[
          { value: "total", label: t("periodTotal") },
          { value: "month", label: t("periodMonth") },
        ]}
      />
      <AdminCheckbox
        id="category-price-required"
        name="priceRequired"
        label={t("priceRequired")}
        defaultChecked={category?.price_required ?? true}
      />
      <AdminCheckbox
        id="category-condition"
        name="hasCondition"
        label={t("hasCondition")}
        defaultChecked={category?.has_condition ?? true}
      />
      {category ? (
        <AdminCheckbox
          id="category-active"
          name="isActive"
          label={isRoot ? t("activeRoot") : t("active")}
          defaultChecked={category.is_active}
        />
      ) : null}
    </>
  );
}
