import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CloseIcon } from "@/components/icons";
import type { Catalog } from "@/lib/catalog-types";
import {
  attributeParam,
  citySlug,
  filterableAttributes,
  type SearchFilters,
} from "@/lib/search/params";
import { SheetClose } from "./sheet-close";

// Hoja de filtros (wireframe 03). Se abre con el ancla #filtros y CSS :target, sin JavaScript;
// el botón "atrás" de Android la cierra. Al aplicar se envía como formulario GET a /buscar.
// Con JavaScript, Next cambia la URL con pushState, que no actualiza :target: por eso quien la pinta
// le da una key con los filtros (al cambiar, se monta de nuevo y queda cerrada), y aplicar o limpiar
// sustituyen la entrada #filtros del historial en vez de añadir otra.

const fieldClass =
  "h-12 w-full rounded-control border border-border bg-bg px-3 text-base outline-primary";

export async function FiltersSheet({
  filters,
  catalog,
  clearHref,
}: {
  filters: SearchFilters;
  catalog: Catalog;
  clearHref: string;
}) {
  const t = await getTranslations("catalog.filters");
  const roots = catalog.categories.filter((c) => c.parent_id === null);
  const attributes = filterableAttributes(catalog, filters.category);
  const showCondition = !filters.category || filters.category.has_condition;

  return (
    <div
      id="filtros"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filtros-titulo"
      className="fixed inset-0 z-20 hidden flex-col bg-text/50 target:flex"
    >
      <SheetClose label={t("close")} className="flex-1" />
      <Form
        action="/buscar"
        replace
        className="mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[20px] bg-bg"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <SheetClose label={t("close")} className="-ml-2 flex size-11 items-center justify-center">
            <CloseIcon className="size-6" />
          </SheetClose>
          <h2 id="filtros-titulo" className="text-[17px] font-extrabold">
            {t("title")}
          </h2>
          <Link href={clearHref} replace className="py-2 text-sm font-semibold text-primary">
            {t("clear")}
          </Link>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
          {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
          {filters.sort !== "relevancia" ? (
            <input type="hidden" name="orden" value={filters.sort} />
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("category")}</span>
            <select
              name="categoria"
              defaultValue={filters.category?.slug ?? ""}
              className={fieldClass}
            >
              <option value="">{t("anyCategory")}</option>
              {roots.map((root) => (
                <optgroup key={root.id} label={root.name}>
                  <option value={root.slug}>{t("allIn", { name: root.name })}</option>
                  {catalog.categories
                    .filter((c) => c.parent_id === root.id)
                    .map((sub) => (
                      <option key={sub.id} value={sub.slug}>
                        {sub.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {attributes.length === 0 ? (
              <span className="text-xs text-text-muted">{t("categoryHint")}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("city")}</span>
            <select
              name="ciudad"
              defaultValue={filters.city ? citySlug(filters.city) : ""}
              className={fieldClass}
            >
              <option value="">{t("anyCity")}</option>
              {catalog.cities.map((city) => (
                <option key={city.id} value={citySlug(city)}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">{t("price")}</legend>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="precio_min"
                inputMode="numeric"
                defaultValue={filters.priceMin ?? ""}
                placeholder={t("min")}
                aria-label={t("priceMin")}
                className={fieldClass}
              />
              <input
                name="precio_max"
                inputMode="numeric"
                defaultValue={filters.priceMax ?? ""}
                placeholder={t("max")}
                aria-label={t("priceMax")}
                className={fieldClass}
              />
            </div>
          </fieldset>

          {showCondition ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-semibold">{t("condition")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["", t("anyCondition")],
                    ["nuevo", t("new")],
                    ["usado", t("used")],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="relative">
                    <input
                      type="radio"
                      name="estado"
                      value={value}
                      defaultChecked={
                        (filters.condition === "new"
                          ? "nuevo"
                          : filters.condition === "used"
                            ? "usado"
                            : "") === value
                      }
                      className="peer sr-only"
                    />
                    <span className="flex h-11 items-center justify-center rounded-full border border-border text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {attributes.map((attribute) => {
            const name = attributeParam(attribute);
            if (attribute.type === "select") {
              const value = filters.attributes[attribute.key];
              return (
                <label key={attribute.id} className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{attribute.label}</span>
                  <select
                    name={name}
                    defaultValue={typeof value === "string" ? value : ""}
                    className={fieldClass}
                  >
                    <option value="">{t("any")}</option>
                    {attribute.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (attribute.type === "boolean") {
              return (
                <label key={attribute.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name={name}
                    value="si"
                    defaultChecked={filters.attributes[attribute.key] === true}
                    className="size-5 accent-primary"
                  />
                  <span className="text-base">{attribute.label}</span>
                </label>
              );
            }
            const [min, max] = filters.ranges[attribute.key] ?? [null, null];
            const label = attribute.unit
              ? `${attribute.label} (${attribute.unit})`
              : attribute.label;
            return (
              <fieldset key={attribute.id} className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name={`${name}_min`}
                    inputMode="numeric"
                    defaultValue={min ?? ""}
                    placeholder={t("from")}
                    aria-label={t("rangeMin", { label: attribute.label })}
                    className={fieldClass}
                  />
                  <input
                    name={`${name}_max`}
                    inputMode="numeric"
                    defaultValue={max ?? ""}
                    placeholder={t("to")}
                    aria-label={t("rangeMax", { label: attribute.label })}
                    className={fieldClass}
                  />
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            className="min-h-[52px] w-full rounded-control bg-primary px-5 text-base font-bold text-white"
          >
            {t("apply")}
          </button>
        </div>
      </Form>
    </div>
  );
}
