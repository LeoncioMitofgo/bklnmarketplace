import { z } from "zod";
import { normalizeGqPhone } from "@/lib/format";
import { USERNAME_PATTERN } from "@/lib/identifiers";

// Los mensajes son claves de i18n (auth.errors.*), no textos.

export const passwordSchema = z
  .string()
  .min(8, { error: "password.length" })
  .max(72, { error: "password.length" });

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "displayName.length" })
    .max(50, { error: "displayName.length" }),
  username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN, { error: "username.format" }),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeGqPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phone.format" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "email.format" })),
  password: passwordSchema,
  terms: z.literal("on", { error: "terms.required" }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/** { campo: "clave.de.error" } con el primer error de cada campo. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message;
  }
  return result;
}
