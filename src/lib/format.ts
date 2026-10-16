// Formatos locales de Guinea Ecuatorial (ALCANCE §5.6). Funciones puras: sirven en servidor y cliente.

export const TIME_ZONE = "Africa/Malabo";

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/**
 * 150000 → "150.000". Agrupa también las cifras de 4 dígitos ("5.000"),
 * que Intl con locale "es" deja sin separar.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(THOUSANDS, ".");
}

/** 150000 → "150.000 FCFA". El sufijo "/mes" de los alquileres lo añade la interfaz (i18n). */
export function formatXaf(amount: number): string {
  return `${formatNumber(amount)} FCFA`;
}

/**
 * Normaliza un teléfono de GE a "+240XXXXXXXXX". Acepta espacios, guiones, paréntesis
 * y los prefijos +240, 00240 o 240. Devuelve null si no es válido.
 * Debe coincidir con la normalización de public.resolve_login_email().
 */
export function normalizeGqPhone(input: string): string | null {
  const value = input.trim();
  if (!/^[\d\s+()-]+$/.test(value)) return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00240")) {
    digits = digits.slice(5);
  } else if (digits.length === 12 && digits.startsWith("240")) {
    digits = digits.slice(3);
  }
  return /^\d{9}$/.test(digits) ? `+240${digits}` : null;
}

/** "+240222123456" → "+240 222 123 456". Si no tiene el formato esperado, lo devuelve igual. */
export function formatGqPhone(e164: string): string {
  const match = /^\+240(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match ? `+240 ${match[1]} ${match[2]} ${match[3]}` : e164;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Fecha en dd/mm/aaaa con la hora de Malabo. */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

/** Tiempo de respuesta redondeado a la unidad que se lee mejor: 45 → 45 min, 130 → 2 h, 3000 → 2 días. */
export function responseTimeParts(minutes: number): {
  unit: "minutes" | "hours" | "days";
  count: number;
} {
  if (minutes < 60) return { unit: "minutes", count: Math.max(1, Math.round(minutes)) };
  if (minutes < 60 * 24) return { unit: "hours", count: Math.round(minutes / 60) };
  return { unit: "days", count: Math.round(minutes / (60 * 24)) };
}

// ─── Fechas del chat (hora de Malabo) ────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const clockFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  weekday: "short",
});
const shortDateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});
const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
});

/** "10:42" */
export function formatClock(date: Date | string): string {
  return clockFormatter.format(new Date(date));
}

/** Día de calendario en Malabo, "2026-10-17": sirve para agrupar mensajes por día. */
export function dayKey(date: Date | string): string {
  return dayKeyFormatter.format(new Date(date));
}

/** Días de calendario entre `date` y `now` en Malabo: 0 hoy, 1 ayer… */
export function calendarDaysAgo(date: Date | string, now: Date | number): number {
  return Math.round((Date.parse(dayKey(new Date(now))) - Date.parse(dayKey(date))) / DAY_MS);
}

/**
 * Hora de la bandeja (wireframe 10): hoy "10:42", ayer (lo traduce quien la pinta),
 * esta semana "lun", antes "12 oct".
 */
export function inboxTime(
  date: Date | string,
  now: Date | number,
): { kind: "today" | "yesterday" | "week" | "older"; text: string } {
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return { kind: "today", text: formatClock(date) };
  if (days === 1) return { kind: "yesterday", text: "" };
  if (days < 7)
    return { kind: "week", text: weekdayFormatter.format(new Date(date)).replace(".", "") };
  return { kind: "older", text: shortDateFormatter.format(new Date(date)).replace(".", "") };
}

/** Separador de día del chat: "17 de octubre" (hoy y ayer los traduce quien lo pinta). */
export function formatLongDate(date: Date | string): string {
  return longDateFormatter.format(new Date(date));
}
