"use client";

import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";

// Error al cargar una pantalla (casi siempre, conexión cortada): explicar y dejar reintentar.
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errorPage");
  return (
    <main className="flex flex-col gap-4 px-4 pt-10">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-base leading-relaxed text-text-muted">{t("body")}</p>
      <button type="button" onClick={() => retry()} className={buttonClasses("primary")}>
        {t("retry")}
      </button>
    </main>
  );
}
