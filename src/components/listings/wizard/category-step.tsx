"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import type { Category } from "@/lib/catalog-types";
import { saveCategory } from "@/lib/listings/actions";

type CategoryStepProps = {
  listingId: string;
  categories: Category[];
  selectedId: number | null;
  onSelected: (categoryId: number) => void;
  onBack: () => void;
};

export function CategoryStep({
  listingId,
  categories,
  selectedId,
  onSelected,
  onBack,
}: CategoryStepProps) {
  const t = useTranslations("listings.category");
  const tWizard = useTranslations("listings.wizard");
  const tErrors = useTranslations("listings.errors");
  const selected = categories.find((c) => c.id === selectedId);
  const [rootId, setRootId] = useState<number | null>(selected?.parent_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roots = categories.filter((c) => c.parent_id === null);
  const children = categories.filter((c) => c.parent_id === rootId);
  const root = roots.find((c) => c.id === rootId);

  function choose(category: Category) {
    setError(null);
    startTransition(async () => {
      const result = await saveCategory(listingId, category.id).catch(() => null);
      if (result?.ok) onSelected(category.id);
      else setError(tErrors(result?.error ?? "offline"));
    });
  }

  const row =
    "flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left text-base";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-text-muted">{t("subtitle")}</p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {root ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setRootId(null)}
            className="flex min-h-11 items-center self-start text-sm font-semibold text-primary"
          >
            ‹ {t("back")}
          </button>
          <p className="text-sm font-bold text-text-muted">{root.name}</p>
          <ul className="divide-y divide-border rounded-card border border-border">
            {children.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choose(category)}
                  aria-current={category.id === selectedId ? "true" : undefined}
                  className={`${row} ${category.id === selectedId ? "font-bold text-primary" : ""}`}
                >
                  {category.name}
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border">
          {roots.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => setRootId(category.id)}
                className={`${row} ${category.id === selected?.parent_id ? "font-bold text-primary" : ""}`}
              >
                {category.name}
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex gap-2.5 pt-2">
        <button type="button" onClick={onBack} className={buttonClasses("secondary", "flex-1")}>
          {tWizard("back")}
        </button>
      </div>
    </div>
  );
}
