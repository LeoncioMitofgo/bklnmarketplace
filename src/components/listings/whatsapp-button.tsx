"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PhoneIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";

type WhatsAppAction = (
  state: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

/**
 * Botón de WhatsApp de la ficha o de la tienda (solo con sesión y si el vendedor lo activó). El
 * teléfono no está en la página: la acción lo pide al pulsar, con tope diario, y abre wa.me.
 */
export function WhatsAppButton({
  action: serverAction,
  fields,
  compact = false,
}: {
  action: WhatsAppAction;
  fields: Record<string, string>;
  compact?: boolean;
}) {
  const t = useTranslations("chat");
  const [state, action, pending] = useActionState(serverAction, {});
  return (
    <form action={action} className="relative flex-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "", compact)}>
        <PhoneIcon className="size-5" />
        {pending ? t("contact.opening") : t("contact.whatsapp")}
      </button>
      {state.error ? (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-full mb-2 rounded-control bg-text px-3 py-2 text-xs text-white"
        >
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}
