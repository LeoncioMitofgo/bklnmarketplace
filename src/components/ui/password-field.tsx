"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { describedBy, FieldShell, inputClasses } from "./field";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string;
};

export function PasswordField({ id, name, label, autoComplete, hint, error }: PasswordFieldProps) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={inputClasses("pr-24")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1 right-1 min-h-11 rounded-control px-3 text-sm font-semibold text-primary"
        >
          {visible ? t("hidePassword") : t("showPassword")}
        </button>
      </div>
    </FieldShell>
  );
}
