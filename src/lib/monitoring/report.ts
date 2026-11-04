// Partes puras del envío de errores a Sentry (D-072), separadas de la red para poder probarlas.

export type ErrorReport = {
  source: "server" | "client";
  type: string;
  message: string;
  stack?: string;
  /** Ruta de la petición. Se manda sin la query: ahí pueden ir tokens (enlaces de verificación). */
  path?: string;
  method?: string;
  /** Archivo de la ruta en App Router (/anuncio/[slug]): agrupa los errores de una misma pantalla. */
  route?: string;
  /** Identificador que React da a los errores de Server Components. */
  digest?: string;
  userAgent?: string;
  tags?: Record<string, string | undefined>;
};

export type ErrorEnv = { environment: string; release?: string; site: string };

type Frame = { function: string; filename: string; lineno: number; colno: number; in_app: boolean };

/** https://<clave>@<host>/<proyecto> → la dirección de los sobres y la clave pública. */
export function parseDsn(dsn: string | undefined): { url: string; publicKey: string } | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    const project = parts.pop();
    if (!u.username || !project) return null;
    const prefix = parts.map((p) => `/${p}`).join("");
    return {
      url: `${u.protocol}//${u.host}${prefix}/api/${project}/envelope/`,
      publicKey: u.username,
    };
  } catch {
    return null;
  }
}

/** Valor del error lanzado, sea o no un Error. */
export function describeError(
  err: unknown,
): Pick<ErrorReport, "type" | "message" | "stack" | "digest"> {
  if (!(err instanceof Error)) return { type: "Error", message: String(err) };
  const digest = "digest" in err && typeof err.digest === "string" ? err.digest : undefined;
  return { type: err.name, message: err.message, stack: err.stack, digest };
}

// Cortes de conexión y ruido del navegador: con 3G son constantes y no hay nada que arreglar.
const NOISE =
  /Failed to fetch|Load failed|NetworkError|Network request failed|Connection closed|ChunkLoadError|Loading chunk|ResizeObserver loop|^Script error/i;

export function isNoise(report: Pick<ErrorReport, "type" | "message">): boolean {
  return NOISE.test(report.type) || NOISE.test(report.message);
}

// Líneas de la pila de Chrome y Node ("at fn (archivo:1:2)") y de Safari y Firefox ("fn@archivo:1:2").
const V8_FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

export function parseStack(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? "").split("\n")) {
    const m = V8_FRAME.exec(line) ?? GECKO_FRAME.exec(line);
    if (!m) continue;
    frames.push({
      function: m[1] || "?",
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/node_modules|^node:/.test(m[2]),
    });
  }
  // Sentry los quiere del más antiguo al más reciente.
  return frames.reverse();
}

/**
 * El sobre ("envelope") de la API de Sentry con un solo evento. Lleva lo justo para saber qué falla
 * y dónde: ni cookies, ni cabeceras salvo el navegador, ni la IP del usuario (la petición sale del
 * servidor).
 */
export function buildEnvelope(report: ErrorReport, dsn: string, env: ErrorEnv, now = new Date()) {
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const path = report.path?.split(/[?#]/)[0];
  const frames = parseStack(report.stack);
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: report.source === "client" ? "javascript" : "node",
    level: "error",
    environment: env.environment,
    release: env.release,
    transaction: report.route ?? path,
    tags: { source: report.source, ...report.tags },
    request: path
      ? {
          method: report.method,
          url: `${env.site}${path}`,
          headers: report.userAgent ? { "User-Agent": report.userAgent } : undefined,
        }
      : undefined,
    exception: {
      values: [
        {
          type: report.type,
          value: report.message,
          stacktrace: frames.length ? { frames } : undefined,
        },
      ],
    },
    extra: report.digest ? { digest: report.digest } : undefined,
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}
