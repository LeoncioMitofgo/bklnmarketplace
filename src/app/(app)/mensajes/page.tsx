import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { InboxLive } from "@/components/chat/inbox-live";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getConversations } from "@/lib/chat/queries";
import type { ConversationRole } from "@/lib/chat/types";
import { inboxTime } from "@/lib/format";
import { imageUrl } from "@/lib/listings/images";

// Bandeja de mensajes (wireframe 10): Todos / Comprando / Vendiendo, no leídos y estado del anuncio.

const TABS = { todos: null, comprando: "buyer", vendiendo: "seller" } as const satisfies Record<
  string,
  ConversationRole | null
>;
type Tab = keyof typeof TABS;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function InboxPage({ searchParams }: PageProps<"/mensajes">) {
  const t = await getTranslations("chat.inbox");
  return (
    <main className="flex flex-col gap-4 pt-6">
      <h1 className="px-4 text-2xl font-extrabold">{t("title")}</h1>
      <Suspense fallback={<p className="px-4 text-text-muted">{t("loading")}</p>}>
        <InboxContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InboxContent({ searchParams }: Pick<PageProps<"/mensajes">, "searchParams">) {
  const { ver } = await searchParams;
  const tab: Tab = typeof ver === "string" && ver in TABS ? (ver as Tab) : "todos";
  const user = await getSessionUser();
  if (!user)
    redirect(
      `/entrar?next=${encodeURIComponent(tab === "todos" ? "/mensajes" : `/mensajes?ver=${tab}`)}`,
    );

  const [conversations, t] = await Promise.all([
    getConversations(TABS[tab]),
    getTranslations("chat"),
  ]);
  const now = Date.now();

  return (
    <>
      <nav aria-label={t("inbox.title")} className="flex gap-2 px-4">
        {(Object.keys(TABS) as Tab[]).map((name) => (
          <Link
            key={name}
            href={name === "todos" ? "/mensajes" : `/mensajes?ver=${name}`}
            aria-current={name === tab ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm ${
              name === tab ? "bg-primary font-semibold text-white" : "border border-border"
            }`}
          >
            {t(`inbox.tabs.${name}`)}
          </Link>
        ))}
      </nav>

      {conversations.length === 0 ? (
        <div className="mx-4 flex flex-col items-center gap-4 rounded-card bg-surface px-4 py-8 text-center">
          <p className="text-sm text-text-muted">{t(`inbox.empty.${tab}`)}</p>
          <Link href="/" className={buttonClasses("primary", "w-auto")}>
            {t("inbox.explore")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {conversations.map((c) => {
            const time = c.last_message_at ? inboxTime(c.last_message_at, now) : null;
            const name = c.other_display_name ?? t("deletedUser");
            const title =
              c.listing_title ??
              t(
                !c.listing_id || c.listing_status === "deleted"
                  ? "deletedListing"
                  : "unavailableListing",
              );
            const listingLine = c.role === "seller" ? t("inbox.yourListing", { title }) : title;
            const status =
              c.listing_status && c.listing_status !== "active" && c.listing_title
                ? t(`listingStatus.${c.listing_status}`)
                : null;
            const preview = c.last_message_preview ?? t("inbox.photo");
            const unread = c.unread_count > 0;
            return (
              <li key={c.id}>
                <Link href={`/mensajes/${c.id}`} className="flex gap-3 px-4 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-control bg-placeholder">
                    {c.cover_path ? (
                      // biome-ignore lint/performance/noImgElement: miniatura ya comprimida (D-019).
                      <img
                        src={imageUrl(c.cover_path, c.cover_format ?? "webp", "thumb")}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>
                        {name}
                      </span>
                      {time ? (
                        <span
                          className={`shrink-0 text-xs ${unread ? "font-semibold text-primary" : "text-text-muted"}`}
                        >
                          {time.kind === "yesterday" ? t("inbox.yesterday") : time.text}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {status ? `${listingLine} · ${status}` : listingLine}
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${unread ? "text-text" : "text-text-muted"}`}
                      >
                        {c.last_sender_is_me ? t("inbox.you", { text: preview }) : preview}
                      </span>
                      {unread ? (
                        <span
                          role="img"
                          aria-label={t("inbox.unread", { count: c.unread_count })}
                          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white"
                        >
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <InboxLive userId={user.id} />
    </>
  );
}
