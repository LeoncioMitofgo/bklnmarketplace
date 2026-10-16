"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { HomeIcon, MessageIcon, PlusIcon, SearchIcon, UserIcon } from "@/components/icons";
import { getUnreadCount } from "@/lib/chat/actions";

// Barra inferior (IDENTIDAD §6): Inicio · Buscar · Publicar · Mensajes · Perfil.

const TABS = [
  { href: "/", key: "home", Icon: HomeIcon },
  { href: "/buscar", key: "search", Icon: SearchIcon },
  { href: "/mensajes", key: "messages", Icon: MessageIcon },
  { href: "/cuenta", key: "profile", Icon: UserIcon },
] as const;

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Cada cuánto, como mucho, se vuelve a preguntar por los no leídos al navegar. */
const UNREAD_REFRESH_MS = 20_000;

/**
 * Contador de no leídos: solo con sesión (hay cookie de Supabase). Se pide al cargar, al navegar
 * (como mucho cada 20 s) y cuando el chat avisa de que ha cambiado (evento "bkln:unread").
 */
function useUnreadCount(pathname: string | null) {
  const [count, setCount] = useState(0);
  const lastFetch = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: se vuelve a mirar al cambiar de página.
  useEffect(() => {
    const load = (force: boolean) => {
      if (!document.cookie.includes("-auth-token")) return setCount(0);
      if (!force && Date.now() - lastFetch.current < UNREAD_REFRESH_MS) return;
      lastFetch.current = Date.now();
      getUnreadCount()
        .then(setCount)
        .catch(() => {});
    };
    load(false);
    const onChange = () => load(true);
    window.addEventListener("bkln:unread", onChange);
    return () => window.removeEventListener("bkln:unread", onChange);
  }, [pathname]);

  return count;
}

export function BottomNav() {
  const pathname = usePathname();
  return <BottomNavView pathname={pathname} unread={useUnreadCount(pathname)} />;
}

/** Sin pathname (mientras carga) se pinta igual, sin pestaña activa. */
export function BottomNavView({
  pathname,
  unread = 0,
}: {
  pathname: string | null;
  unread?: number;
}) {
  const t = useTranslations("nav");
  const [home, search, messages, profile] = TABS;

  const tab = ({ href, key, Icon }: (typeof TABS)[number]) => {
    const active = isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={
          key === "messages" && unread > 0 ? t("messagesUnread", { count: unread }) : undefined
        }
        className={`relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
          active ? "font-bold text-primary" : "text-text-muted"
        }`}
      >
        <Icon className="size-[22px]" />
        {key === "messages" && unread > 0 ? (
          <span className="absolute top-0 right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        {t(key)}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {tab(home)}
        {tab(search)}
        <Link
          href="/publicar"
          aria-label={t("publish")}
          className="flex size-12 items-center justify-center rounded-full bg-accent text-text"
        >
          <PlusIcon className="size-6" />
        </Link>
        {tab(messages)}
        {tab(profile)}
      </div>
    </nav>
  );
}
