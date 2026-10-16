/**
 * Ruta interna a la que volver después de entrar (ALCANCE §4.3: "vuelta exacta").
 * Solo acepta rutas del propio sitio: nada de "//otro.com", barras invertidas ni
 * caracteres de control (los navegadores los eliminan y "/\t/otro.com" acabaría en otro dominio).
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: se buscan precisamente caracteres de control.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  return value;
}
