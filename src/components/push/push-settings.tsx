"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { disablePush, enablePush, type PushState, pushState } from "@/lib/push/client";

/** Avisos en este móvil, en Mi cuenta: activar, desactivar o explicar por qué no se puede. */
export function PushSettings() {
  const t = useTranslations("push");
  const [state, setState] = useState<PushState | "error" | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = pushState();
    setState(current);
    if (current === "granted") {
      navigator.serviceWorker
        .getRegistration("/sw.js")
        .then((registration) => registration?.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => {});
    }
  }, []);

  if (state === null) return null;

  async function toggle() {
    setBusy(true);
    if (subscribed) {
      await disablePush().catch(() => {});
      setSubscribed(false);
    } else {
      const result = await enablePush();
      setState(result);
      setSubscribed(result === "granted");
    }
    setBusy(false);
  }

  const text =
    state === "unsupported"
      ? t("unsupported")
      : state === "denied"
        ? t("denied")
        : state === "error"
          ? t("error")
          : subscribed
            ? t("on")
            : t("off");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed">{text}</p>
      {state !== "unsupported" && state !== "denied" ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={buttonClasses(subscribed ? "ghost" : "secondary", "min-h-11")}
        >
          {busy ? t("activating") : subscribed ? t("deactivate") : t("activate")}
        </button>
      ) : null}
    </div>
  );
}
