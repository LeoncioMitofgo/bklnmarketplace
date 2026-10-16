import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ListingPin } from "@/components/chat/listing-pin";
import { NewConversation } from "@/components/chat/new-conversation";
import { ChatSafetyNotice } from "@/components/chat/safety-notice";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { findConversationForListing } from "@/lib/chat/queries";
import { getPublicListing } from "@/lib/listings/public";

// Entrada al chat desde la ficha ("Chatear"). Sin sesión, pasa por entrar y vuelve aquí (ALCANCE §5.4).
// Si ya hay conversación con este anuncio, lleva a ella; si no, el primer mensaje la crea.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function NewConversationPage({ params }: PageProps<"/mensajes/anuncio/[code]">) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<div className="flex-1" />}>
        <NewConversationContent params={params} />
      </Suspense>
    </div>
  );
}

async function NewConversationContent({
  params,
}: Pick<PageProps<"/mensajes/anuncio/[code]">, "params">) {
  const { code } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/mensajes/anuncio/${code}`)}`);

  const listing = /^[a-z2-9]{8}$/.test(code) ? await getPublicListing(code) : null;
  if (!listing) notFound();

  const [existing, catalog, t] = await Promise.all([
    findConversationForListing(listing.id, user.id),
    getCatalog(),
    getTranslations("chat.conversation"),
  ]);
  if (existing) redirect(`/mensajes/${existing}`);

  const isOwn = listing.user_id === user.id;
  const available = listing.status === "active";

  return (
    <>
      <ChatHeader
        conversationId={null}
        other={{
          id: listing.user_id,
          username: listing.seller.username,
          displayName: listing.seller.display_name,
          responseTimeMinutes: listing.seller.response_time_minutes,
        }}
        blockedByMe={false}
      />
      <ListingPin
        catalog={catalog}
        listing={{
          code: listing.code,
          title: listing.title,
          status: listing.status,
          priceXaf: listing.price_xaf,
          categoryId: listing.category_id,
          cityId: listing.city_id,
          coverPath: listing.images[0]?.storage_path ?? null,
          coverFormat: listing.images[0]?.format ?? null,
        }}
      />
      <div className="px-4 pt-3">
        <ChatSafetyNotice />
      </div>
      {isOwn || !available ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base">{isOwn ? t("ownListing") : t("notAvailable")}</p>
          {isOwn ? (
            <Link href="/mis-anuncios" className={buttonClasses("secondary", "w-auto")}>
              {t("goToMine")}
            </Link>
          ) : null}
        </div>
      ) : (
        <NewConversation listingId={listing.id} code={listing.code} />
      )}
    </>
  );
}
