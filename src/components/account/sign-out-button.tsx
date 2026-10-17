"use client";

import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { disablePush } from "@/lib/push/client";

/**
 * Cerrar sesión. Antes da de baja los avisos de este móvil, para que no sigan llegando
 * los mensajes de esta cuenta a quien lo use después. Sin JavaScript, cierra sesión sin más.
 */
export function SignOutButton({ label }: { label: string }) {
  const ready = useRef(false);
  return (
    <form
      action={signOut}
      onSubmit={(event) => {
        if (ready.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
        Promise.race([disablePush().catch(() => {}), timeout]).finally(() => {
          ready.current = true;
          form.requestSubmit();
        });
      }}
    >
      <button type="submit" className={buttonClasses("ghost")}>
        {label}
      </button>
    </form>
  );
}
