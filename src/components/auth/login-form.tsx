"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormFeedback } from "./form-feedback";

/** `next`: ruta a la que volver después de entrar (ya validada en el servidor). */
export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.login");
  const [state, action] = useActionState(signIn, initialFormState);
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <div className="flex flex-col gap-5">
      {next ? (
        <p className="rounded-card bg-surface px-3.5 py-3 text-sm leading-relaxed text-text-muted">
          {t("returnNotice")}
        </p>
      ) : null}

      <form action={action} className="flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormFeedback state={state} />
        <TextField
          id="login-identifier"
          name="identifier"
          label={t("identifier")}
          placeholder={t("identifierPlaceholder")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.values?.identifier}
        />
        <PasswordField
          id="login-password"
          name="password"
          label={t("password")}
          autoComplete="current-password"
        />
        <Link
          href="/recuperar"
          className="flex min-h-11 items-center self-end text-sm font-semibold text-primary"
        >
          {t("forgot")}
        </Link>
        <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
      </form>

      <div className="flex items-center gap-3 text-sm text-text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("noAccount")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Link href={withNext("/registro")} className={buttonClasses("secondary")}>
        {t("createAccount")}
      </Link>
    </div>
  );
}
