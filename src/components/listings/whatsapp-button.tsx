"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PhoneIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { openWhatsApp } from "@/lib/chat/actions";

/**
 * Botón de WhatsApp de la ficha (solo con sesión y si el vendedor lo activó). El teléfono no está
 * en la página: lo pide al pulsar, con tope diario, y abre wa.me con el anuncio en el mensaje.
 */
export function WhatsAppButton({ code }: { code: string }) {
  const t = useTranslations("chat");
  const [state, action, pending] = useActionState(openWhatsApp, {});
  return (
    <form action={action} className="relative flex-1">
      <input type="hidden" name="code" value={code} />
      <button type="submit" disabled={pending} className={buttonClasses("secondary")}>
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
