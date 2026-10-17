import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeftIcon, MoreIcon } from "@/components/icons";
import { setBlocked } from "@/lib/chat/actions";
import { responseTimeParts } from "@/lib/format";

/** Cabecera de la conversación: volver, con quién hablas y menú (ver perfil, denunciar, bloquear). */
export async function ChatHeader({
  conversationId,
  other,
  blockedByMe,
}: {
  conversationId: string | null;
  other: {
    id: string | null;
    username: string | null;
    displayName: string | null;
    responseTimeMinutes: number | null;
  };
  blockedByMe: boolean;
}) {
  const t = await getTranslations("chat");
  const name = other.displayName ?? t("deletedUser");
  const response =
    other.responseTimeMinutes !== null ? responseTimeParts(other.responseTimeMinutes) : null;

  return (
    <header className="flex items-center gap-1 border-b border-border px-1 py-1.5">
      <Link
        href="/mensajes"
        aria-label={t("conversation.back")}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <ChevronLeftIcon className="size-6" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-bold">{name}</p>
        {response ? (
          <p className="truncate text-xs text-text-muted">
            {t("conversation.responds", {
              time: t(`conversation.responseTime.${response.unit}`, { count: response.count }),
            })}
          </p>
        ) : null}
      </div>
      {other.id && other.username ? (
        // key: tras bloquear o desbloquear, el menú se vuelve a montar cerrado.
        <details key={String(blockedByMe)} className="relative">
          <summary
            aria-label={t("conversation.menu")}
            className="flex size-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden"
          >
            <MoreIcon className="size-6" />
          </summary>
          <div className="absolute right-1 z-20 mt-1 flex w-60 flex-col rounded-card border border-border bg-bg py-1">
            <Link href={`/u/${other.username}`} className="flex min-h-11 items-center px-4 text-sm">
              {t("conversation.viewProfile")}
            </Link>
            {conversationId ? (
              <Link
                href={`/mensajes/${conversationId}/denunciar`}
                prefetch={false}
                className="flex min-h-11 items-center px-4 text-sm text-danger"
              >
                {t("conversation.report", { name })}
              </Link>
            ) : null}
            {conversationId ? (
              <form action={setBlocked}>
                <input type="hidden" name="conversationId" value={conversationId} />
                <input type="hidden" name="userId" value={other.id} />
                <input type="hidden" name="block" value={blockedByMe ? "0" : "1"} />
                <button
                  type="submit"
                  className={`flex min-h-11 w-full items-center px-4 text-left text-sm ${
                    blockedByMe ? "" : "text-danger"
                  }`}
                >
                  {t(blockedByMe ? "conversation.unblock" : "conversation.block", { name })}
                </button>
              </form>
            ) : null}
          </div>
        </details>
      ) : null}
    </header>
  );
}
