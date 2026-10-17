"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { type DeleteAccountState, deleteAccount } from "@/lib/account/actions";

type Labels = {
  password: string;
  submit: string;
  submitting: string;
  /** deleteAccount.errors, ya traducidos (la página es la única que los usa). */
  errors: Record<string, string>;
};

const FIELD_ERRORS = new Set(["password_required", "invalid_password"]);

/** Confirmación con la contraseña. Si va bien, el servidor redirige a /cuenta-borrada. */
export function DeleteAccountForm({ labels }: { labels: Labels }) {
  const [state, action] = useActionState(deleteAccount, {} as DeleteAccountState);
  const message = state.error
    ? (labels.errors[state.error] ?? labels.errors.unexpected)
    : undefined;
  const isFieldError = state.error ? FIELD_ERRORS.has(state.error) : false;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {message && !isFieldError ? <Alert tone="error">{message}</Alert> : null}
      <PasswordField
        id="delete-password"
        name="password"
        label={labels.password}
        autoComplete="current-password"
        error={isFieldError ? message : undefined}
      />
      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} variant="danger" />
    </form>
  );
}
