// Cálculo de las métricas de validación (ALCANCE §9) a partir de las filas que devuelve la base de
// datos. Separado de la consulta para poder probarlo sin Supabase.

export type ValidationRows = {
  /** Anuncios publicados por primera vez en los últimos 30 días. */
  publishedIds: string[];
  /** Anuncio de cada conversación con mensajes empezada en los últimos 30 días. */
  conversationListingIds: (string | null)[];
  /** Anuncio de cada pulsación de «Llamar» de los últimos 30 días; null si fue desde la tienda (D-081). */
  callListingIds: (string | null)[];
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
  /** Con al menos un mensaje o una llamada. */
  listingsContacted: number;
  /** Porcentaje entero; null si no se ha publicado nada. */
  listingsContactedPct: number | null;
  /** Pulsaciones de «Llamar» en 30 días, desde la ficha o la tienda. */
  calls: number;
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
  const contacted = new Set(
    [...rows.conversationListingIds, ...rows.callListingIds].filter(
      (id): id is string => id !== null && published.has(id),
    ),
  );
  const active = new Set(rows.activeUserIds.filter((id): id is string => id !== null));
  const newUsers = new Set(rows.newUserIds);
  const returning = [...active].filter((id) => !newUsers.has(id)).length;
  return {
    listingsPublished: published.size,
    listingsContacted: contacted.size,
    listingsContactedPct:
      published.size === 0 ? null : Math.round((contacted.size / published.size) * 100),
    calls: rows.callListingIds.length,
    medianResponseMinutes: median(rows.responseTimes),
    sellersWithResponseTime: rows.responseTimes.length,
    activeUsers: active.size,
    returningUsers: returning,
    premiumRequests: rows.premiumRequests,
    premiumActivations: rows.premiumActivations,
  };
}
