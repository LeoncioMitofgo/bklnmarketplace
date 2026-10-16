"use client";

import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, SendIcon } from "@/components/icons";
import {
  markConversationRead,
  prepareChatImage,
  sendMessage,
  sendMessageForm,
} from "@/lib/chat/actions";
import { subscribePrivate } from "@/lib/chat/realtime";
import { CHAT_IMAGES_BUCKET, type ChatMessage } from "@/lib/chat/types";
import { calendarDaysAgo, dayKey, formatClock, formatLongDate } from "@/lib/format";
import { compressImage } from "@/lib/listings/compress";
import { uploadWithProgress } from "@/lib/listings/upload";
import { createClient } from "@/lib/supabase/client";

// Conversación (wireframe 11): mensajes en tiempo real (canal privado conversation:{id}),
// envío optimista con "Reintentar", fotos comprimidas en el móvil, "Visto" y borrador guardado.

type Pending = {
  key: string;
  body: string | null;
  file?: File;
  previewUrl?: string;
  status: "sending" | "failed";
  progress?: number;
  error?: string;
};

type Props = {
  conversationId: string;
  meId: string;
  initialMessages: ChatMessage[];
  otherLastReadAt: string | null;
  /** Motivo por el que no se puede escribir (bloqueo, cuenta borrada…), o null. */
  disabledReason: string | null;
  /** Lo que va encima de los mensajes: aviso de seguridad y "Ver anteriores". */
  top?: React.ReactNode;
};

const UNREAD_EVENT = "bkln:unread";
const draftKey = (id: string) => `bkln:borrador:${id}`;

export function ChatThread({
  conversationId,
  meId,
  initialMessages,
  otherLastReadAt,
  disabledReason,
  top,
}: Props) {
  const t = useTranslations("chat.conversation");
  const tErrors = useTranslations("chat.errors");
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<Pending[]>([]);
  const [otherReadAt, setOtherReadAt] = useState(otherLastReadAt);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0);
  const now = Date.now();

  const markRead = useCallback(() => {
    markConversationRead(conversationId)
      .then(() => window.dispatchEvent(new Event(UNREAD_EVENT)))
      .catch(() => {});
  }, [conversationId]);

  const addMessage = useCallback((message: ChatMessage) => {
    lastId.current = Math.max(lastId.current, message.id);
    setMessages((current) =>
      current.some((m) => m.id === message.id)
        ? current
        : [...current, message].sort((a, b) => a.id - b.id),
    );
  }, []);

  // Borrador: lo escrito no se pierde aunque se cierre la página o se corte la red.
  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey(conversationId)) ?? "");
    } catch {}
  }, [conversationId]);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey(conversationId), text);
      else localStorage.removeItem(draftKey(conversationId));
    } catch {}
  }, [conversationId, text]);

  // Tiempo real y lectura.
  useEffect(() => {
    markRead();
    const supabase = createClient();

    const receive = async (message: ChatMessage) => {
      if (message.image_path) {
        const { data } = await supabase.storage
          .from(CHAT_IMAGES_BUCKET)
          .createSignedUrl(message.image_path, 3600);
        message.image_url = data?.signedUrl ?? null;
      }
      addMessage(message);
      if (message.sender_id !== meId && document.visibilityState === "visible") markRead();
    };

    // Al quedar suscrito (y al reconectar), pide lo que haya llegado mientras tanto.
    const catchUp = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, body, image_path, created_at")
        .eq("conversation_id", conversationId)
        .gt("id", lastId.current)
        .order("id");
      for (const message of data ?? []) await receive(message);
    };

    const unsubscribe = subscribePrivate(
      supabase,
      `conversation:${conversationId}`,
      {
        message: (payload) => void receive(payload as unknown as ChatMessage),
        read: (payload) => {
          if (payload.reader_id !== meId) setOtherReadAt(String(payload.read_at));
        },
      },
      () => void catchUp(),
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [conversationId, meId, addMessage, markRead]);

  // Abajo del todo al abrir y al llegar mensajes, salvo que el usuario esté leyendo más arriba.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se recoloca cuando cambia la lista.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const updatePending = (key: string, patch: Partial<Pending>) =>
    setPending((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function deliver(item: Pending) {
    updatePending(item.key, { status: "sending", error: undefined });
    try {
      let imagePath: string | null = null;
      if (item.file) {
        const compressed = await compressImage(item.file).catch(() => null);
        if (!compressed) throw new Error("photo_unreadable");
        const prepared = await prepareChatImage(conversationId, compressed.format);
        if (!prepared.ok) throw new Error(prepared.error);
        await uploadWithProgress(prepared.data.signedUrl, compressed.large.blob, (progress) =>
          updatePending(item.key, { progress }),
        );
        imagePath = prepared.data.path;
      }
      const result = await sendMessage(conversationId, item.body, imagePath);
      if (!result.ok) throw new Error(result.error);
      addMessage(result.data);
      setPending((current) => current.filter((p) => p.key !== item.key));
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    } catch (error) {
      const key = error instanceof Error ? error.message : "unexpected";
      const known = ["network", "timeout"].includes(key) || !navigator.onLine ? "offline" : key;
      updatePending(item.key, {
        status: "failed",
        error: tErrors.has(known) ? known : "unexpected",
      });
    }
  }

  function submitText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    const item: Pending = { key: crypto.randomUUID(), body, status: "sending" };
    stickToBottom.current = true;
    setPending((current) => [...current, item]);
    setText("");
    void deliver(item);
  }

  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const item: Pending = {
      key: crypto.randomUUID(),
      body: null,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "sending",
      progress: 0,
    };
    stickToBottom.current = true;
    setPending((current) => [...current, item]);
    void deliver(item);
  }

  const lastMine = [...messages].reverse().find((m) => m.sender_id === meId);
  const seen = lastMine && otherReadAt && otherReadAt >= lastMine.created_at;

  const dayLabel = (iso: string) => {
    const days = calendarDaysAgo(iso, now);
    return days === 0 ? t("today") : days === 1 ? t("yesterday") : formatLongDate(iso);
  };

  return (
    <>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-3"
      >
        {top}
        {messages.map((message, index) => {
          const mine = message.sender_id === meId;
          const newDay =
            index === 0 || dayKey(messages[index - 1].created_at) !== dayKey(message.created_at);
          return (
            <Fragment key={message.id}>
              {newDay ? (
                <p className="my-2 self-center rounded-full bg-surface px-3 py-1 text-xs text-text-muted">
                  {dayLabel(message.created_at)}
                </p>
              ) : null}
              <Bubble mine={mine} time={formatClock(message.created_at)}>
                {message.image_path ? (
                  <ChatImage url={message.image_url ?? null} alt={t("photoAlt")} />
                ) : null}
                {message.body ? (
                  <p className="whitespace-pre-line break-words">{message.body}</p>
                ) : null}
              </Bubble>
              {seen && message.id === lastMine?.id ? (
                <p className="self-end pr-1 text-[11px] text-text-muted">{t("seen")}</p>
              ) : null}
            </Fragment>
          );
        })}
        {pending.map((item) => (
          <div key={item.key} className="flex flex-col items-end gap-1">
            <Bubble mine time={item.status === "sending" ? t("sending") : ""}>
              {item.previewUrl ? (
                // biome-ignore lint/performance/noImgElement: vista previa local de la foto.
                <img src={item.previewUrl} alt="" className="max-h-60 rounded-xl opacity-70" />
              ) : null}
              {item.body ? <p className="whitespace-pre-line break-words">{item.body}</p> : null}
              {item.status === "sending" && item.progress !== undefined ? (
                <p className="text-xs">
                  {t("uploading", { percent: Math.round(item.progress * 100) })}
                </p>
              ) : null}
            </Bubble>
            {item.status === "failed" ? (
              <p className="flex items-center gap-2 text-xs text-danger">
                {tErrors(item.error ?? "unexpected")}
                <button
                  type="button"
                  onClick={() => void deliver(item)}
                  className="min-h-9 font-semibold text-primary underline"
                >
                  {t("retry")}
                </button>
              </p>
            ) : null}
          </div>
        ))}
        <span id="ultimo" />
      </div>

      {disabledReason ? (
        <p className="border-t border-border bg-surface px-4 py-4 text-center text-sm text-text-muted">
          {disabledReason}
        </p>
      ) : (
        <form
          action={sendMessageForm}
          onSubmit={submitText}
          className="flex items-end gap-2 border-t border-border bg-bg px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <input type="hidden" name="conversationId" value={conversationId} />
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary">
            <span className="sr-only">{t("addPhoto")}</span>
            <CameraIcon className="size-6" />
            <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
          </label>
          <textarea
            name="body"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-base leading-snug outline-primary [field-sizing:content]"
          />
          <button
            type="submit"
            aria-label={t("send")}
            disabled={!text.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
          >
            <SendIcon className="size-5" />
          </button>
        </form>
      )}
    </>
  );
}

function Bubble({
  mine,
  time,
  children,
}: {
  mine: boolean;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex max-w-[82%] flex-col gap-1 rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
        mine
          ? "self-end rounded-br-md bg-primary text-white"
          : "self-start rounded-bl-md bg-surface"
      }`}
    >
      {children}
      {time ? (
        <span className={`self-end text-[11px] ${mine ? "text-white/80" : "text-text-muted"}`}>
          {time}
        </span>
      ) : null}
    </div>
  );
}

function ChatImage({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <div className="h-40 w-52 rounded-xl bg-placeholder" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* biome-ignore lint/performance/noImgElement: foto privada con URL firmada (sin optimizador, D-019). */}
      <img src={url} alt={alt} loading="lazy" className="max-h-72 rounded-xl object-cover" />
    </a>
  );
}
