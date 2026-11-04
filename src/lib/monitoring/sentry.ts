import "server-only";
import { siteUrl } from "@/lib/site";
import { buildEnvelope, type ErrorReport, isNoise, parseDsn } from "./report";

/**
 * Manda un error a Sentry con su API, sin SDK (D-072), como Resend. Sin SENTRY_DSN no hace nada.
 * Nunca lanza ni espera más de 2 s: la monitorización no puede romper ni frenar una respuesta.
 */
export async function captureError(report: ErrorReport): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  const target = parseDsn(dsn);
  if (!dsn || !target || isNoise(report)) return;
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=bkln/1`,
      },
      body: buildEnvelope(report, dsn, {
        environment: process.env.VERCEL_ENV ?? "development",
        release: process.env.VERCEL_GIT_COMMIT_SHA,
        site: siteUrl(),
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) console.error("sentry_error", response.status);
  } catch (error) {
    console.error("sentry_error", error instanceof Error ? error.message : error);
  }
}
