"use client";

import { useEffect } from "react";

// Errores del navegador a Sentry a través de /api/errors (D-072), sin scripts de terceros que pesen
// en 3G. Solo se monta con SENTRY_DSN (layout raíz). Como mucho 5 avisos por visita y sin repetir.

let enabled = false;
const sent = new Set<string>();

export function reportClientError(error: unknown) {
  if (!enabled || sent.size >= 5 || !navigator.onLine) return;
  const e = error instanceof Error ? error : new Error(String(error));
  // Los de Server Components llegan con digest y ya los mandó el servidor.
  if ("digest" in e && e.digest) return;
  const key = `${e.name}:${e.message}`;
  if (sent.has(key)) return;
  sent.add(key);
  navigator.sendBeacon(
    "/api/errors",
    JSON.stringify({
      type: e.name.slice(0, 100),
      message: e.message.slice(0, 1000),
      stack: e.stack?.slice(0, 5000),
      path: location.pathname.slice(0, 500),
    }),
  );
}

export function ErrorReporter() {
  useEffect(() => {
    enabled = true;
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
