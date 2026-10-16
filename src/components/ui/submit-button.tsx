"use client";

import { useFormStatus } from "react-dom";
import { type ButtonVariant, buttonClasses } from "./button";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  variant?: ButtonVariant;
};

/** Botón de envío que se desactiva y cambia de texto mientras la Server Action trabaja. */
export function SubmitButton({ label, pendingLabel, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={buttonClasses(variant)}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
