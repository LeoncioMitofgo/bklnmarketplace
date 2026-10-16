"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormFeedback, useFormText } from "./form-feedback";

export function SignUpForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.signup");
  const text = useFormText();
  const [state, action] = useActionState(signUp, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormFeedback state={state} />
        <TextField
          id="signup-name"
          name="displayName"
          label={t("displayName")}
          autoComplete="name"
          required
          defaultValue={values.displayName}
          error={text.error(errors.displayName)}
        />
        <TextField
          id="signup-username"
          name="username"
          label={t("username")}
          hint={t("usernameHint")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={values.username}
          error={text.error(errors.username)}
        />
        <TextField
          id="signup-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          prefix="+240"
          label={t("phone")}
          hint={t("phoneHint")}
          placeholder="222 123 456"
          autoComplete="tel-national"
          required
          defaultValue={values.phone}
          error={text.error(errors.phone)}
        />
        <TextField
          id="signup-email"
          name="email"
          type="email"
          inputMode="email"
          label={t("email")}
          hint={t("emailHint")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={values.email}
          error={text.error(errors.email)}
        />
        <PasswordField
          id="signup-password"
          name="password"
          label={t("password")}
          hint={t("passwordHint")}
          autoComplete="new-password"
          error={text.error(errors.password)}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <input
              id="signup-terms"
              name="terms"
              type="checkbox"
              required
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? "signup-terms-error" : undefined}
              className="mt-0.5 size-6 shrink-0 accent-primary"
            />
            <label htmlFor="signup-terms" className="text-sm leading-relaxed">
              {t.rich("terms", {
                terms: (chunks) => (
                  <Link href="/terminos" className="font-semibold text-primary underline">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacidad" className="font-semibold text-primary underline">
                    {chunks}
                  </Link>
                ),
              })}
            </label>
          </div>
          {errors.terms ? (
            <p id="signup-terms-error" className="text-sm text-danger">
              {text.error(errors.terms)}
            </p>
          ) : null}
        </div>
        <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
      </form>

      <p className="text-center text-sm">
        {t("haveAccount")}{" "}
        <Link
          href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"}
          className="font-bold text-primary"
        >
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
