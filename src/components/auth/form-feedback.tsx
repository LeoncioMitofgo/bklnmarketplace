"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/auth/form-state";

/** Traduce las claves que devuelven las Server Actions (auth.errors.* / auth.messages.*). */
export function useFormText() {
  const tErrors = useTranslations("auth.errors");
  const tMessages = useTranslations("auth.messages");
  return {
    error: (key?: string) => (key ? tErrors(key) : undefined),
    message: (key: string, values?: Record<string, string>) => tMessages(key, values),
  };
}

export function FormFeedback({ state }: { state: FormState }) {
  const text = useFormText();
  if (state.formError) return <Alert tone="error">{text.error(state.formError)}</Alert>;
  if (state.status === "success" && state.message) {
    return <Alert tone="success">{text.message(state.message, state.messageValues)}</Alert>;
  }
  return null;
}
