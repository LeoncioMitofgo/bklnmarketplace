"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { changeListingStatus, type StatusAction } from "@/lib/listings/actions";
import type { ListingStatus } from "@/lib/listings/queries";

type ListingRowActionsProps = {
  id: string;
  status: ListingStatus;
  canRenew: boolean;
};

const BUTTON =
  "inline-flex min-h-11 items-center rounded-full border border-border px-3.5 text-sm font-semibold text-primary disabled:opacity-50";

/** Acciones de "Mis anuncios" según el estado (ALCANCE §5.1). Los cambios pasan por las RPC. */
export function ListingRowActions({ id, status, canRenew }: ListingRowActionsProps) {
  const t = useTranslations("listings.mine");
  const tErrors = useTranslations("listings.errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: StatusAction) {
    if (action === "delete" && !window.confirm(t("confirmDelete"))) return;
    setError(null);
    startTransition(async () => {
      const result = await changeListingStatus(id, action).catch(() => ({
        ok: false as const,
        error: "offline",
      }));
      if (!result.ok) setError(tErrors(result.error));
    });
  }

  const action = (name: StatusAction, label: string) => (
    <button type="button" disabled={pending} onClick={() => run(name)} className={BUTTON}>
      {label}
    </button>
  );
  const edit = (label: string) => (
    <Link href={`/publicar/${id}`} className={BUTTON}>
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? edit(t("actions.continue")) : null}
        {status === "active" ? (
          <>
            {edit(t("actions.edit"))}
            {canRenew ? action("renew", t("actions.renew")) : null}
            {action("sold", t("actions.sold"))}
            {action("pause", t("actions.pause"))}
          </>
        ) : null}
        {status === "paused" ? (
          <>
            {action("reactivate", t("actions.reactivate"))}
            {edit(t("actions.edit"))}
          </>
        ) : null}
        {status === "sold" ? action("reactivate", t("actions.republish")) : null}
        {status === "expired" ? (
          <>
            {action("renew", t("actions.renew"))}
            {edit(t("actions.edit"))}
          </>
        ) : null}
        {action("delete", t("actions.delete"))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
