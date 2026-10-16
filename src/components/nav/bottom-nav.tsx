"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HomeIcon, MessageIcon, PlusIcon, SearchIcon, UserIcon } from "@/components/icons";

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

export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

/** Sin pathname (mientras carga) se pinta igual, sin pestaña activa. */
export function BottomNavView({ pathname }: { pathname: string | null }) {
  const t = useTranslations("nav");
  const [home, search, messages, profile] = TABS;

  const tab = ({ href, key, Icon }: (typeof TABS)[number]) => {
    const active = isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
          active ? "font-bold text-primary" : "text-text-muted"
        }`}
      >
        <Icon className="size-[22px]" />
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
