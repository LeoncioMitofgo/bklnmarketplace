// Reglas de los identificadores de cuenta (ALCANCE §5.7, D-012).
// Deben coincidir con las restricciones de public.profiles y con public.resolve_login_email().

/** 3–20 caracteres: minúsculas, números, "." y "_"; empieza por letra (así nunca parece un teléfono). */
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,19}$/;

export type LoginIdentifierKind = "email" | "phone" | "username";

/** Lo que el usuario escribe en "Usuario, email o teléfono". */
export function detectIdentifierKind(input: string): LoginIdentifierKind {
  const value = input.trim();
  if (value.includes("@")) return "email";
  if (/^[\d\s+]+$/.test(value)) return "phone";
  return "username";
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(input));
}

/** "juan.perez@gmail.com" → "j***@gmail.com": se enseña el email sin revelarlo entero. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
