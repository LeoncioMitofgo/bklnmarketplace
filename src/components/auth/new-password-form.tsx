"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPassword } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormFeedback, useFormText } from "./form-feedback";

export function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.newPassword");
  const tSignup = useTranslations("auth.signup");
  const text = useFormText();
  const [state, action] = useActionState(resetPassword, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormFeedback state={state} />
      <PasswordField
        id="new-password"
        name="password"
        label={t("password")}
        hint={tSignup("passwordHint")}
        autoComplete="new-password"
        error={text.error(state.fieldErrors?.password)}
      />
      <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
      {state.formError === "form.linkInvalid" ? (
        <Link
          href="/recuperar"
          className="flex min-h-11 items-center justify-center text-sm font-bold text-primary"
        >
          {t("requestNew")}
        </Link>
      ) : null}
    </form>
  );
}
