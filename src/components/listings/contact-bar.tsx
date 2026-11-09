import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MessageIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { openWhatsApp } from "@/lib/chat/actions";
import { isWhatsappEnabled } from "@/lib/chat/queries";
import { CallLink } from "./call-link";
import { WhatsAppButton } from "./whatsapp-button";

// Barra fija de la ficha (IDENTIDAD §6): Llamar (solo icono, si la tienda tiene teléfono para
// llamadas, D-081), WhatsApp (contorno, opcional) y Chatear (relleno). Lo que depende de la sesión
// va en su <Suspense>; mientras tanto se ve lo que vale para todos: Llamar y Chatear.

type Props = {
  listingId: string;
  code: string;
  sellerId: string;
  /** Teléfono para llamadas de la tienda del vendedor, público. */
  callPhone: string | null;
};

export function ContactBar(props: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
      <div className={`mx-auto flex max-w-md px-4 py-3 ${props.callPhone ? "gap-2" : "gap-3"}`}>
        <Suspense
          fallback={
            <>
              <Call {...props} />
              <ChatLink code={props.code} compact={props.callPhone !== null} />
            </>
          }
        >
          <ContactActions {...props} />
        </Suspense>
      </div>
    </div>
  );
}

async function Call({ callPhone, sellerId, listingId }: Props) {
  if (!callPhone) return null;
  const t = await getTranslations("chat.contact");
  return (
    <CallLink
      phone={callPhone}
      storeUserId={sellerId}
      listingId={listingId}
      label={t("call")}
      showLabel={false}
      className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-control border-2 border-primary bg-bg text-primary hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
    />
  );
}

async function ChatLink({ code, compact }: { code: string; compact: boolean }) {
  const t = await getTranslations("chat.contact");
  return (
    <Link
      href={`/mensajes/anuncio/${code}`}
      className={buttonClasses("primary", "flex-1", compact)}
    >
      <MessageIcon className="size-5" />
      {t("chat")}
    </Link>
  );
}

async function ContactActions(props: Props) {
  const { listingId, code, sellerId, callPhone } = props;
  const user = await getSessionUser();
  if (user?.id === sellerId) {
    const t = await getTranslations("chat.contact");
    return (
      <Link href={`/publicar/${listingId}`} className={buttonClasses("secondary", "flex-1")}>
        {t("edit")}
      </Link>
    );
  }
  const whatsapp = user ? await isWhatsappEnabled(listingId) : false;
  const compact = callPhone !== null;
  return (
    <>
      <Call {...props} />
      {whatsapp ? (
        <WhatsAppButton action={openWhatsApp} fields={{ code }} compact={compact} />
      ) : null}
      <ChatLink code={code} compact={compact} />
    </>
  );
}
