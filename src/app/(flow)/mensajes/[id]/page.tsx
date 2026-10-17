import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatThread } from "@/components/chat/chat-thread";
import { ListingPin } from "@/components/chat/listing-pin";
import { ChatSafetyNotice } from "@/components/chat/safety-notice";
import { PushPrompt } from "@/components/push/push-prompt";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { getConversation, getMessages } from "@/lib/chat/queries";
import { MESSAGES_PAGE } from "@/lib/chat/types";

// Conversación (wireframe 11): anuncio fijado arriba, aviso de seguridad, mensajes y caja de texto.

const MAX_PAGES = 10;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function ConversationPage({ params, searchParams }: PageProps<"/mensajes/[id]">) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<ChatSkeleton />}>
        <ConversationContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col">
      <div className="h-14 border-b border-border" />
      <div className="h-16 border-b border-border bg-surface" />
      <div className="flex-1" />
      <div className="h-16 border-t border-border" />
    </div>
  );
}

async function ConversationContent({
  params,
  searchParams,
}: Pick<PageProps<"/mensajes/[id]">, "params" | "searchParams">) {
  const [{ id }, { n }] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/mensajes/${id}`)}`);

  const requested = Number.parseInt(typeof n === "string" ? n : "", 10);
  const pages = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_PAGES) : 1;

  const [conversation, { messages, hasMore }, catalog, t] = await Promise.all([
    getConversation(id),
    getMessages(id, pages * MESSAGES_PAGE),
    getCatalog(),
    getTranslations("chat.conversation"),
  ]);
  if (!conversation) notFound();

  const disabledReason =
    conversation.other_id === null
      ? t("recipientDeleted")
      : conversation.blocked_by_me
        ? t("blockedByMe")
        : conversation.blocked_me
          ? t("blockedMe")
          : null;

  return (
    <>
      <ChatHeader
        conversationId={conversation.id}
        other={{
          id: conversation.other_id,
          username: conversation.other_username,
          displayName: conversation.other_display_name,
          // El tiempo de respuesta solo interesa del vendedor.
          responseTimeMinutes:
            conversation.role === "buyer" ? conversation.other_response_time_minutes : null,
        }}
        blockedByMe={conversation.blocked_by_me}
      />
      <ListingPin
        catalog={catalog}
        listing={{
          code: conversation.listing_code,
          title: conversation.listing_title,
          status: conversation.listing_status,
          priceXaf: conversation.listing_price_xaf,
          categoryId: conversation.listing_category_id,
          cityId: conversation.listing_city_id,
          coverPath: conversation.cover_path,
          coverFormat: conversation.cover_format,
        }}
      />
      <ChatThread
        key={conversation.id}
        conversationId={conversation.id}
        meId={user.id}
        initialMessages={messages}
        otherLastReadAt={conversation.other_last_read_at}
        disabledReason={disabledReason}
        top={
          hasMore && pages < MAX_PAGES ? (
            <Link
              href={`/mensajes/${conversation.id}?n=${pages + 1}`}
              className="mb-2 self-center py-2 text-sm font-semibold text-primary"
            >
              {t("older")}
            </Link>
          ) : (
            <>
              <ChatSafetyNotice />
              <div className="mb-2 empty:hidden">
                <PushPrompt />
              </div>
            </>
          )
        }
      />
    </>
  );
}
