import Form from "next/form";
import { getTranslations } from "next-intl/server";
import { SearchIcon } from "@/components/icons";

/**
 * Buscador (formulario GET a /buscar): funciona sin JavaScript y, con él, navega sin recargar.
 * `keep` son los filtros que se conservan al cambiar el texto (categoría, ciudad…).
 */
export async function SearchBar({
  defaultValue = "",
  keep = [],
}: {
  defaultValue?: string;
  keep?: [string, string][];
}) {
  const t = await getTranslations("catalog.search");
  return (
    <Form action="/buscar" role="search" className="flex gap-2">
      <label className="relative flex-1">
        <span className="sr-only">{t("label")}</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={t("placeholder")}
          enterKeyHint="search"
          maxLength={100}
          className="h-12 w-full rounded-control border border-border bg-surface pl-10 pr-3 text-base outline-primary placeholder:text-text-muted"
        />
      </label>
      {keep.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className="h-12 shrink-0 rounded-control bg-primary px-4 text-base font-bold text-white"
      >
        {t("submit")}
      </button>
    </Form>
  );
}
