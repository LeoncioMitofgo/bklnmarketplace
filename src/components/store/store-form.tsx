"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { describedBy, FieldShell, inputClasses, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/auth/form-state";
import { saveStore } from "@/lib/stores/actions";

type Values = {
  name: string;
  slug: string;
  description: string;
  address: string;
  openingHours: string;
};

/** Datos de la tienda (wireframe 05): nombre, dirección web, descripción, dirección y horario. */
export function StoreForm({ initial, isNew }: { initial: Values; isNew: boolean }) {
  const t = useTranslations("store.form");
  const tErrors = useTranslations("store.errors");
  const tMessages = useTranslations("store.messages");
  const [state, action] = useActionState(saveStore, initialFormState);
  const values = (state.values as Values | undefined) ?? initial;
  const errors = state.fieldErrors ?? {};
  const error = (key: string) => (errors[key] ? tErrors(errors[key]) : undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.formError ? <Alert tone="error">{tErrors(state.formError)}</Alert> : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{tMessages(state.message)}</Alert>
      ) : null}
      <TextField
        id="store-name"
        name="name"
        label={t("name")}
        error={error("name")}
        maxLength={60}
        required
        defaultValue={values.name}
      />
      <TextField
        id="store-slug"
        name="slug"
        label={t("slug")}
        hint={t("slugHint")}
        error={error("slug")}
        prefix="/t/"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={40}
        required
        defaultValue={values.slug}
      />
      <TextArea
        id="store-description"
        name="description"
        label={t("description")}
        hint={t("descriptionHint")}
        error={error("description")}
        maxLength={1000}
        rows={4}
        defaultValue={values.description}
      />
      <TextField
        id="store-address"
        name="address"
        label={t("address")}
        hint={t("addressHint")}
        error={error("address")}
        maxLength={200}
        defaultValue={values.address}
      />
      <TextField
        id="store-hours"
        name="openingHours"
        label={t("openingHours")}
        hint={t("openingHoursHint")}
        error={error("openingHours")}
        maxLength={120}
        defaultValue={values.openingHours}
      />
      <SubmitButton
        label={isNew ? t("create") : t("save")}
        pendingLabel={t("saving")}
        variant={isNew ? "accent" : "primary"}
      />
    </form>
  );
}

function TextArea({
  id,
  name,
  label,
  hint,
  error,
  maxLength,
  rows,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  maxLength: number;
  rows: number;
  defaultValue: string;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClasses("py-3 leading-relaxed")}
      />
    </FieldShell>
  );
}
