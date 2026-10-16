"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormFeedback } from "@/components/auth/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerificationEmail } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

export function ResendVerification() {
  const t = useTranslations("account");
  const [state, action] = useActionState(resendVerificationEmail, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormFeedback state={state} />
      {state.status === "success" ? null : (
        <SubmitButton label={t("resend")} pendingLabel={t("resending")} variant="secondary" />
      )}
    </form>
  );
}
