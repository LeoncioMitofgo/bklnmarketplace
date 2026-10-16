"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmEmail } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormFeedback } from "./form-feedback";

/** El token se canjea al pulsar (POST), nunca al abrir el enlace. */
export function VerifyEmailForm({ token }: { token: string }) {
  const t = useTranslations("auth.verifyEmail");
  const [state, action] = useActionState(confirmEmail, initialFormState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <FormFeedback state={state} />
        <Link href="/cuenta" className={buttonClasses("primary")}>
          {t("goToAccount")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-base leading-relaxed text-text-muted">{t("intro")}</p>
      <FormFeedback state={state} />
      <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
    </form>
  );
}
