import { inputClasses } from "@/components/ui/field";

/** Campo de texto corto del panel (motivo, nota), con su etiqueta. */
export function TextAreaField({
  id,
  name,
  label,
  placeholder,
  required = true,
  maxLength = 300,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        required={required}
        maxLength={maxLength}
        rows={2}
        placeholder={placeholder}
        className={inputClasses("py-3")}
      />
    </div>
  );
}
