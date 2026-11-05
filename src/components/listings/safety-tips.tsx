import { getTranslations } from "next-intl/server";
import { ShieldCheckIcon } from "@/components/icons";

/**
 * Bloque fijo de consejos de seguridad (ALCANCE §4.2, IDENTIDAD §6). En un encargo cambian: ahí lo
 * normal es un anticipo, y "no pagues nada por adelantado" no sirve (D-079).
 */
export async function SafetyTips({ onOrder = false }: { onOrder?: boolean }) {
  const t = await getTranslations("catalog.listing");
  const tips = onOrder ? "safetyOrder" : "safety";
  return (
    <section className="flex gap-3 rounded-card bg-surface p-4">
      <ShieldCheckIcon className="size-6 shrink-0 text-success" />
      <div className="flex flex-col gap-1.5">
        <h2 className="font-sans text-[15px] font-bold">{t("safety.title")}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-text-muted">
          <li>{t(`${tips}.tip1`)}</li>
          <li>{t(`${tips}.tip2`)}</li>
          <li>{t(`${tips}.tip3`)}</li>
        </ul>
      </div>
    </section>
  );
}
