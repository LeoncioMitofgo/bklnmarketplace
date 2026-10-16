"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { SendIcon } from "@/components/icons";
import { startConversation, startConversationForm } from "@/lib/chat/actions";

/**
 * Primer mensaje a un vendedor: la conversación se crea al enviar, no al abrir la página
 * (así la precarga de enlaces no crea conversaciones vacías). Con respuestas rápidas.
 */
export function NewConversation({ listingId, code }: { listingId: string; code: string }) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draftKey = `bkln:borrador:anuncio:${code}`;

  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey) ?? "");
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey, text]);

  function send(body: string) {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await startConversation(listingId, trimmed).catch(() => null);
      if (result?.ok) {
        setText("");
        router.replace(`/mensajes/${result.data.conversationId}`);
      } else {
        setText(trimmed);
        setError(result ? result.error : navigator.onLine ? "unexpected" : "offline");
      }
    });
  }

  const quickReplies = [
    t("conversation.quick.available"),
    t("conversation.quick.price"),
    t("conversation.quick.where"),
  ];

  return (
    <>
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-3">
        <p className="text-center text-sm text-text-muted">{t("conversation.start")}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {quickReplies.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => send(option)}
              className="min-h-10 rounded-full border border-primary px-3.5 text-sm text-primary disabled:opacity-50"
            >
              {option}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            {t(`errors.${error}`)}
          </p>
        ) : null}
      </div>
      <form
        action={startConversationForm}
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2 border-t border-border bg-bg px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="code" value={code} />
        <textarea
          name="body"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("conversation.placeholder")}
          aria-label={t("conversation.placeholder")}
          rows={1}
          maxLength={2000}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-base leading-snug outline-primary [field-sizing:content]"
        />
        <button
          type="submit"
          aria-label={t("conversation.send")}
          disabled={!text.trim() || pending}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
        >
          <SendIcon className="size-5" />
        </button>
      </form>
    </>
  );
}
