import { inputClasses } from "@/components/ui/field";

// Campos de los formularios del panel (se pintan en el servidor y van dentro de AdminActionForm).

export function AdminInput({
  id,
  label,
  hint,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClasses()}
        {...input}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-snug text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AdminTextArea({
  id,
  label,
  hint,
  ...textarea
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClasses("py-3 leading-relaxed")}
        {...textarea}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-snug text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AdminSelect({
  id,
  label,
  options,
  ...select
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select id={id} className={inputClasses()} {...select}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminCheckbox({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-5 shrink-0 accent-primary"
      />
      {label}
    </label>
  );
}
