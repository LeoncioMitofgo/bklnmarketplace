"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons";

type NavigationApi = { canGoBack?: boolean };

/**
 * Vuelve a la página anterior si era de este sitio; si no (enlace abierto desde WhatsApp,
 * sin JavaScript…), es un enlace normal a `fallbackHref`.
 */
export function BackButton({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <a
      href={fallbackHref}
      aria-label={label}
      className={className}
      onClick={(event) => {
        const navigation = (window as Window & { navigation?: NavigationApi }).navigation;
        if (navigation?.canGoBack) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <ChevronLeftIcon className="size-6" />
    </a>
  );
}
