"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";
import { enablePush, ensurePushSubscription, type PushState, pushState } from "@/lib/push/client";

const DISMISS_KEY = "bkln:avisos-ahora-no";
const DISMISS_DAYS = 7;

/**
 * Invitación a activar los avisos, en la bandeja y en las conversaciones (ALCANCE §4.6).
 * Solo aparece si el navegador los admite y aún no se ha decidido; "Ahora no" la oculta 7 días.
 * Si el permiso ya está concedido, comprueba en silencio que este móvil sigue suscrito.
 */
export function PushPrompt() {
  const t = useTranslations("push");
  const [state, setState] = useState<PushState | "error" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = pushState();
    if (current === "granted") void ensurePushSubscription();
    let dismissed = false;
    try {
      dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
    } catch {}
    setState(dismissed ? null : current);
  }, []);

  if (state !== "default" && state !== "error") return null;

  async function activate() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setState(result === "granted" || result === "denied" ? null : result);
  }

  function later() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
    } catch {}
    setState(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/30 bg-surface p-4">
      <p className="flex gap-3 text-sm leading-relaxed">
        <BellIcon className="size-5 shrink-0 text-primary" />
        {state === "error" ? t("error") : t("prompt")}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={activate}
          disabled={busy}
          className="min-h-11 flex-1 rounded-control bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? t("activating") : t("activate")}
        </button>
        <button
          type="button"
          onClick={later}
          className="min-h-11 rounded-control px-4 text-sm font-semibold text-primary"
        >
          {t("later")}
        </button>
      </div>
    </div>
  );
}
