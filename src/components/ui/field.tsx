import type { InputHTMLAttributes, ReactNode } from "react";

// Campo de formulario accesible: etiqueta, ayuda y error enlazados con aria-describedby.

const INPUT_CLASSES =
  "min-h-[52px] w-full min-w-0 rounded-control border border-border bg-bg px-3.5 text-base text-text " +
  "placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary " +
  "aria-[invalid=true]:border-danger";

export function inputClasses(extra = ""): string {
  return `${INPUT_CLASSES} ${extra}`;
}

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-snug text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm leading-snug text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> & {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Prefijo fijo a la izquierda, p. ej. "+240". */
  prefix?: string;
};

export function TextField({ id, name, label, hint, error, prefix, ...input }: TextFieldProps) {
  const field = (
    <input
      id={id}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={inputClasses()}
      {...input}
    />
  );

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {prefix ? (
        <div className="flex gap-2">
          <span className="flex min-h-[52px] items-center rounded-control border border-border bg-surface px-3 text-base">
            {prefix}
          </span>
          {field}
        </div>
      ) : (
        field
      )}
    </FieldShell>
  );
}
