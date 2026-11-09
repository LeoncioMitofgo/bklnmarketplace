import { getTranslations } from "next-intl/server";
import { isIndexable } from "@/lib/seo";

/**
 * Aviso de versión previa (D-066): hasta el lanzamiento conviven los anuncios de demostración (D-047)
 * con los de las tiendas fundadoras. Desaparece al abrir la indexación (SITE_INDEXABLE=true).
 * data-nosnippet: las tiendas reales ya se indexan (D-081) y el aviso no debe salir en Google.
 */
export async function PreviewNotice() {
  if (isIndexable()) return null;
  const t = await getTranslations("preview");
  return (
    <p
      data-nosnippet
      className="border-b border-border bg-surface px-4 py-2 text-center text-xs leading-relaxed text-text-muted"
    >
      <strong className="font-semibold text-text">{t("title")}</strong> {t("notice")}
    </p>
  );
}
