"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormFeedback, useFormText } from "@/components/auth/form-feedback";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeEmail, changePassword, changePhone } from "@/lib/account/settings-actions";
import { type FormState, initialFormState } from "@/lib/auth/form-state";

// Email, teléfono y contraseña (ALCANCE §4.3): cada cambio pide la contraseña actual.

function CurrentPassword({ id, state }: { id: string; state: FormState }) {
  const t = useTranslations("settings.access");
  const text = useFormText();
  return (
    <PasswordField
      id={id}
      name="currentPassword"
      label={t("currentPassword")}
      autoComplete="current-password"
      error={text.error(state.fieldErrors?.currentPassword)}
    />
  );
}

export function EmailForm({ current }: { current: string }) {
  const t = useTranslations("settings.access");
  const text = useFormText();
  const [state, action] = useActionState(changeEmail, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-text-muted">{t("now", { value: current })}</p>
      <FormFeedback state={state} />
      <TextField
        id="access-email"
        name="email"
        type="email"
        label={t("newEmail")}
        hint={t("emailHint")}
        error={text.error(state.fieldErrors?.email)}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.status === "error" ? state.values?.email : undefined}
      />
      <CurrentPassword id="access-email-password" state={state} />
      <SubmitButton label={t("saveEmail")} pendingLabel={t("saving")} variant="secondary" />
    </form>
  );
}

export function PhoneForm({ current }: { current: string }) {
  const t = useTranslations("settings.access");
  const text = useFormText();
  const [state, action] = useActionState(changePhone, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-text-muted">{t("now", { value: current })}</p>
      <FormFeedback state={state} />
      <TextField
        id="access-phone"
        name="phone"
        inputMode="tel"
        prefix="+240"
        label={t("newPhone")}
        hint={t("phoneHint")}
        error={text.error(state.fieldErrors?.phone)}
        autoComplete="tel-national"
        required
        defaultValue={state.status === "error" ? state.values?.phone : undefined}
      />
      <CurrentPassword id="access-phone-password" state={state} />
      <SubmitButton label={t("savePhone")} pendingLabel={t("saving")} variant="secondary" />
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings.access");
  const text = useFormText();
  const [state, action] = useActionState(changePassword, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <CurrentPassword id="access-password-current" state={state} />
      <PasswordField
        id="access-password-new"
        name="newPassword"
        label={t("newPassword")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        error={text.error(state.fieldErrors?.newPassword)}
      />
      <SubmitButton label={t("savePassword")} pendingLabel={t("saving")} variant="secondary" />
    </form>
  );
}
