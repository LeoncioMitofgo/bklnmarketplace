import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MessageIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { isWhatsappEnabled } from "@/lib/chat/queries";
import { WhatsAppButton } from "./whatsapp-button";

// Barra fija de la ficha (IDENTIDAD §6): WhatsApp (contorno, opcional) y Chatear (relleno).
// Lo que depende de la sesión va en su <Suspense>; mientras tanto se ve "Chatear", que vale para todos.

type Props = { listingId: string; code: string; sellerId: string };

export function ContactBar(props: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md gap-3 px-4 py-3">
        <Suspense fallback={<ChatLink code={props.code} />}>
          <ContactActions {...props} />
        </Suspense>
      </div>
    </div>
  );
}

async function ChatLink({ code }: { code: string }) {
  const t = await getTranslations("chat.contact");
  return (
    <Link href={`/mensajes/anuncio/${code}`} className={buttonClasses("primary", "flex-1")}>
      <MessageIcon className="size-5" />
      {t("chat")}
    </Link>
  );
}

async function ContactActions({ listingId, code, sellerId }: Props) {
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
  return (
    <>
      {whatsapp ? <WhatsAppButton code={code} /> : null}
      <ChatLink code={code} />
    </>
  );
}
