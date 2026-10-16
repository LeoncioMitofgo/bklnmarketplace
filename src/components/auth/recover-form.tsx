"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormFeedback } from "./form-feedback";

export function RecoverForm() {
  const t = useTranslations("auth.recover");
  const tLogin = useTranslations("auth.login");
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-text-muted">{t("intro")}</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormFeedback state={state} />
        {state.status === "success" ? null : (
          <>
            <TextField
              id="recover-identifier"
              name="identifier"
              label={tLogin("identifier")}
              placeholder={tLogin("identifierPlaceholder")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              defaultValue={state.values?.identifier}
            />
            <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
          </>
        )}
      </form>
      <Link
        href="/entrar"
        className="flex min-h-11 items-center justify-center text-sm font-bold text-primary"
      >
        {t("backToLogin")}
      </Link>
    </div>
  );
}
