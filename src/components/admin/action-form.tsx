"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { type ButtonVariant, buttonClasses } from "@/components/ui/button";
import type { AdminActionState } from "@/lib/admin/types";

export type AdminButton = { label: string; variant?: ButtonVariant; intent?: string };

/**
 * Formulario de una acción del panel: los campos llegan como children (pintados en el servidor) y
 * el resultado, ya traducido, se muestra encima. Funciona sin JavaScript.
 *
 * Con varios botones, cada uno envía su `intent`. Conviene que el formulario siga en la página
 * aunque cambie el estado (p. ej. con los botones que tocan): si se desmonta, se pierde el mensaje.
 */
export function AdminActionForm({
  action,
  buttons,
  pendingLabel,
  children,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  buttons: AdminButton[];
  pendingLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? (
        <Alert tone={state.status === "ok" ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      {children}
      {buttons.length > 0 ? <Buttons buttons={buttons} pendingLabel={pendingLabel} /> : null}
    </form>
  );
}

function Buttons({ buttons, pendingLabel }: { buttons: AdminButton[]; pendingLabel: string }) {
  const { pending, data } = useFormStatus();
  const sent = data?.get("intent");
  return (
    <div className="flex flex-col gap-2">
      {buttons.map((button) => (
        <button
          key={button.intent ?? button.label}
          type="submit"
          name={button.intent ? "intent" : undefined}
          value={button.intent}
          disabled={pending}
          className={buttonClasses(button.variant ?? "primary")}
        >
          {pending && (!button.intent || sent === button.intent) ? pendingLabel : button.label}
        </button>
      ))}
    </div>
  );
}
