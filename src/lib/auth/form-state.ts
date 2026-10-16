/**
 * Estado que devuelven las Server Actions de los formularios.
 * `formError` y `fieldErrors` son claves bajo `auth.errors`; `message`, bajo `auth.messages`.
 * `values` devuelve lo que escribió el usuario
 * (nunca contraseñas) para que no se pierda nada si hay un error.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  formError?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  messageValues?: Record<string, string>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
