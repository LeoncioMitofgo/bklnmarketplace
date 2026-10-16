import { getTranslations } from "next-intl/server";
import { ShieldCheckIcon } from "@/components/icons";

/** Bloque fijo de consejos de seguridad (ALCANCE §4.2, IDENTIDAD §6). */
export async function SafetyTips() {
  const t = await getTranslations("catalog.listing.safety");
  return (
    <section className="flex gap-3 rounded-card bg-surface p-4">
      <ShieldCheckIcon className="size-6 shrink-0 text-success" />
      <div className="flex flex-col gap-1.5">
        <h2 className="font-sans text-[15px] font-bold">{t("title")}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-text-muted">
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
        </ul>
      </div>
    </section>
  );
}
