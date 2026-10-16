"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { describedBy, FieldShell, inputClasses, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { attributesFor, type Catalog } from "@/lib/catalog-types";
import { type DetailsState, saveDetails } from "@/lib/listings/actions";
import { parsePrice } from "@/lib/listings/details";
import type { EditableListing } from "@/lib/listings/queries";

type DetailsStepProps = {
  listing: EditableListing;
  catalog: Catalog;
  onSaved: (changes: Partial<EditableListing>) => void;
  onBack: () => void;
};

type Values = Record<string, string>;

const backupKey = (id: string) => `bkln:anuncio:${id}`;

function valuesFromListing(listing: EditableListing): Values {
  const values: Values = {
    title: listing.title ?? "",
    description: listing.description ?? "",
    condition: listing.condition ?? "",
    price: listing.price_xaf === null ? "" : String(listing.price_xaf),
    negotiable: listing.is_negotiable ? "on" : "",
    cityId: listing.city_id === null ? "" : String(listing.city_id),
    neighborhood: listing.neighborhood ?? "",
  };
  for (const [key, value] of Object.entries(listing.attributes ?? {})) {
    values[`attr_${key}`] = value === true ? "on" : value === false ? "" : String(value);
  }
  return values;
}

/** Copia local de lo escrito: si se corta la red o se recarga la página, no se pierde nada. */
function readBackup(listing: EditableListing): Values | null {
  try {
    const raw = localStorage.getItem(backupKey(listing.id));
    if (!raw) return null;
    const backup = JSON.parse(raw) as { savedAt: number; values: Values };
    return backup.savedAt > Date.parse(listing.updated_at) ? backup.values : null;
  } catch {
    return null;
  }
}

export function DetailsStep({ listing, catalog, onSaved, onBack }: DetailsStepProps) {
  const t = useTranslations("listings.details");
  const tWizard = useTranslations("listings.wizard");
  const tErrors = useTranslations("listings.errors");
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>(() => valuesFromListing(listing));
  const [restored, setRestored] = useState(false);

  const category = catalog.categories.find((c) => c.id === listing.category_id);
  const defs = attributesFor(catalog, listing.category_id);

  useEffect(() => {
    const backup = readBackup(listing);
    if (backup) {
      setValues(backup);
      setRestored(true);
    }
  }, [listing]);

  function saveBackup() {
    if (!formRef.current) return;
    const data = Object.fromEntries(new FormData(formRef.current)) as Values;
    try {
      localStorage.setItem(
        backupKey(listing.id),
        JSON.stringify({ savedAt: Date.now(), values: data }),
      );
    } catch {
      // Sin almacenamiento local (modo privado): el formulario sigue funcionando.
    }
  }

  const [state, action] = useActionState(
    async (prev: DetailsState, formData: FormData) => {
      const submitted = Object.fromEntries(formData) as Values;
      setValues(submitted);
      try {
        const result = await saveDetails(prev, formData);
        if (result.status === "success") {
          try {
            localStorage.removeItem(backupKey(listing.id));
          } catch {}
          const attributes: EditableListing["attributes"] = {};
          for (const def of defs) {
            const raw = submitted[`attr_${def.key}`] ?? "";
            if (def.type === "boolean") attributes[def.key] = raw === "on";
            else if (raw.trim() !== "")
              attributes[def.key] = def.type === "number" ? Number(parsePrice(raw)) : raw.trim();
          }
          onSaved({
            title: submitted.title.trim(),
            description: submitted.description.trim(),
            condition: (submitted.condition || null) as EditableListing["condition"],
            price_xaf: parsePrice(submitted.price ?? ""),
            is_negotiable: submitted.negotiable === "on",
            city_id: Number(submitted.cityId),
            neighborhood: submitted.neighborhood?.trim() || null,
            attributes,
            updated_at: new Date().toISOString(),
          });
        }
        return result;
      } catch {
        return { status: "error", formError: "offline" } satisfies DetailsState;
      }
    },
    { status: "idle" } satisfies DetailsState,
  );

  const errors = state.fieldErrors ?? {};
  const error = (name: string) => (errors[name] ? tErrors(errors[name]) : undefined);
  const priceLabel = !category?.price_required
    ? t("priceOptional")
    : category.price_period === "month"
      ? t("pricePerMonth")
      : t("price");

  return (
    <form
      ref={formRef}
      action={action}
      onChange={saveBackup}
      className="flex flex-1 flex-col gap-4"
      noValidate
      key={restored ? "restored" : "initial"}
    >
      <input type="hidden" name="listingId" value={listing.id} />
      {restored ? <Alert tone="info">{t("restored")}</Alert> : null}
      {state.formError ? <Alert tone="error">{tErrors(state.formError)}</Alert> : null}

      <TextField
        id="listing-title"
        name="title"
        label={t("title")}
        hint={t("titleHint")}
        maxLength={80}
        required
        defaultValue={values.title}
        error={error("title")}
      />

      {category?.has_condition ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">{t("condition")}</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-control border border-border">
            {(["new", "used"] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-[48px] cursor-pointer items-center justify-center text-base has-[:checked]:bg-primary has-[:checked]:font-semibold has-[:checked]:text-white"
              >
                <input
                  type="radio"
                  name="condition"
                  value={value}
                  defaultChecked={values.condition === value}
                  className="sr-only"
                />
                {t(value)}
              </label>
            ))}
          </div>
          {error("condition") ? <p className="text-sm text-danger">{error("condition")}</p> : null}
        </fieldset>
      ) : null}

      {defs.map((def) => {
        const id = `attr-${def.key}`;
        const name = `attr_${def.key}`;
        const fieldError = error(name);
        const label = def.unit ? `${def.label} (${def.unit})` : def.label;

        if (def.type === "boolean") {
          return (
            <label key={def.key} className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                name={name}
                defaultChecked={values[name] === "on"}
                className="size-6 accent-primary"
              />
              {def.label}
            </label>
          );
        }
        if (def.type === "select") {
          return (
            <FieldShell key={def.key} id={id} label={label} error={fieldError}>
              <select
                id={id}
                name={name}
                defaultValue={values[name] ?? ""}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={describedBy(id, undefined, fieldError)}
                className={inputClasses()}
              >
                <option value="">{t("selectPlaceholder")}</option>
                {def.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldShell>
          );
        }
        return (
          <TextField
            key={def.key}
            id={id}
            name={name}
            label={label}
            inputMode={def.type === "number" ? "numeric" : undefined}
            defaultValue={values[name] ?? ""}
            error={fieldError}
          />
        );
      })}

      <FieldShell
        id="listing-description"
        label={t("description")}
        hint={t("descriptionHint")}
        error={error("description")}
      >
        <textarea
          id="listing-description"
          name="description"
          rows={5}
          maxLength={4000}
          defaultValue={values.description}
          aria-invalid={error("description") ? true : undefined}
          aria-describedby={describedBy(
            "listing-description",
            t("descriptionHint"),
            error("description"),
          )}
          className={inputClasses("py-3 leading-relaxed")}
        />
      </FieldShell>

      <div className="flex flex-col gap-2">
        <TextField
          id="listing-price"
          name="price"
          label={priceLabel}
          hint={t("priceHint")}
          inputMode="numeric"
          defaultValue={values.price}
          error={error("price")}
        />
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="negotiable"
            defaultChecked={values.negotiable === "on"}
            className="size-6 accent-primary"
          />
          {t("negotiable")}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <FieldShell id="listing-city" label={t("city")} error={error("cityId")}>
          <select
            id="listing-city"
            name="cityId"
            defaultValue={values.cityId}
            aria-invalid={error("cityId") ? true : undefined}
            className={inputClasses()}
          >
            <option value="">{t("cityPlaceholder")}</option>
            {catalog.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </FieldShell>
        <TextField
          id="listing-neighborhood"
          name="neighborhood"
          label={t("neighborhood")}
          placeholder={t("neighborhoodPlaceholder")}
          maxLength={80}
          defaultValue={values.neighborhood}
          error={error("neighborhood")}
        />
      </div>

      <div className="mt-auto flex gap-2.5 pt-2">
        <button type="button" onClick={onBack} className={buttonClasses("secondary", "flex-1")}>
          {tWizard("back")}
        </button>
        <div className="flex-[2]">
          <SubmitButton label={t("save")} pendingLabel={t("saving")} />
        </div>
      </div>
    </form>
  );
}
