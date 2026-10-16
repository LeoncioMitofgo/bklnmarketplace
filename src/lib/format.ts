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
