// Cálculo de las métricas de validación (ALCANCE §9) a partir de las filas que devuelve la base de
// datos. Separado de la consulta para poder probarlo sin Supabase.

export type ValidationRows = {
  /** Anuncios publicados por primera vez en los últimos 30 días. */
  publishedIds: string[];
  /** Anuncio de cada conversación con mensajes empezada en los últimos 30 días. */
  conversationListingIds: (string | null)[];
  /** Tiempo de respuesta de cada vendedor que lo tiene calculado (cron diario). */
  responseTimes: number[];
  /** Quien escribió un mensaje o publicó en los últimos 7 días (con repeticiones). */
  activeUserIds: (string | null)[];
  /** Cuentas creadas en los últimos 7 días. */
  newUserIds: string[];
  premiumRequests: number;
  premiumActivations: number;
};

export type ValidationMetrics = {
  listingsPublished: number;
  listingsWithMessage: number;
  /** Porcentaje entero; null si no se ha publicado nada. */
  listingsWithMessagePct: number | null;
  medianResponseMinutes: number | null;
  sellersWithResponseTime: number;
  activeUsers: number;
  returningUsers: number;
  premiumRequests: number;
  premiumActivations: number;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeValidation(rows: ValidationRows): ValidationMetrics {
  const published = new Set(rows.publishedIds);
  const withMessage = new Set(
    rows.conversationListingIds.filter((id): id is string => id !== null && published.has(id)),
  );
  const active = new Set(rows.activeUserIds.filter((id): id is string => id !== null));
  const newUsers = new Set(rows.newUserIds);
  const returning = [...active].filter((id) => !newUsers.has(id)).length;
  return {
    listingsPublished: published.size,
    listingsWithMessage: withMessage.size,
    listingsWithMessagePct:
      published.size === 0 ? null : Math.round((withMessage.size / published.size) * 100),
    medianResponseMinutes: median(rows.responseTimes),
    sellersWithResponseTime: rows.responseTimes.length,
    activeUsers: active.size,
    returningUsers: returning,
    premiumRequests: rows.premiumRequests,
    premiumActivations: rows.premiumActivations,
  };
}
