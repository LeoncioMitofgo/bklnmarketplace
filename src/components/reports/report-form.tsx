"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { CheckIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialReportState, REPORT_DETAILS_MAX, type ReportState } from "@/lib/reports/types";

type Props = {
  /** Server Action: reportListing o reportConversation. */
  action: (state: ReportState, formData: FormData) => Promise<ReportState>;
  /** Textos de report.listing o report.user. */
  kind: "listing" | "user";
  reasons: readonly string[];
  /** listingId o conversationId, y returnTo (vuelta tras entrar). */
  hidden: Record<string, string>;
  backHref: string;
  /** Nombre de la persona denunciada (solo en el chat). */
  name?: string;
  /** Ofrecer "Bloquear también" (chat, si aún no está bloqueada). */
  canBlock?: boolean;
};

/** Formulario de denuncia (ALCANCE §5.5). Funciona sin JavaScript: es un formulario normal. */
export function ReportForm({ action, kind, reasons, hidden, backHref, name, canBlock }: Props) {
  const t = useTranslations("report");
  const [state, formAction] = useActionState(action, initialReportState);

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div
          aria-live="polite"
          className="flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-6 text-center"
        >
          <CheckIcon className="size-8 text-success" />
          <h2 className="font-sans text-lg font-extrabold">{t("doneTitle")}</h2>
          <p className="text-sm leading-relaxed">
            {t(`${kind}.${state.result === "already" ? "already" : "done"}`)}
          </p>
          {state.blocked ? (
            <p className="text-sm leading-relaxed">{t("user.blocked", { name: name ?? "" })}</p>
          ) : null}
        </div>
        {/* Si esta denuncia lo ha ocultado, la ficha ya no existe para nadie. */}
        <Link
          href={state.result === "hidden" ? "/" : backHref}
          className={buttonClasses("secondary")}
        >
          {state.result === "hidden" ? t("home") : t(`${kind}.back`)}
        </Link>
      </div>
    );
  }

  const detailsError = state.error?.startsWith("details_") ? state.error : undefined;
  const formError = state.error && !detailsError ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {formError ? <Alert tone="error">{t(`errors.${formError}`)}</Alert> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("reason")}</legend>
        {reasons.map((reason) => (
          <label
            key={reason}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-surface"
          >
            <input
              type="radio"
              name="reason"
              value={reason}
              required
              defaultChecked={state.values?.reason === reason}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {t(`${kind}.reasons.${reason}.label`)}
              </span>
              <span className="text-xs leading-snug text-text-muted">
                {t(`${kind}.reasons.${reason}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-details" className="text-sm font-semibold">
          {t("details")}
        </label>
        <textarea
          id="report-details"
          name="details"
          rows={4}
          maxLength={REPORT_DETAILS_MAX}
          defaultValue={state.values?.details}
          aria-invalid={detailsError ? true : undefined}
          aria-describedby={detailsError ? "report-details-error" : "report-details-hint"}
          className={inputClasses("py-3 leading-relaxed")}
        />
        {detailsError ? (
          <p id="report-details-error" className="text-sm leading-snug text-danger">
            {t(`errors.${detailsError}`)}
          </p>
        ) : (
          <p id="report-details-hint" className="text-xs leading-snug text-text-muted">
            {t("detailsHint")}
          </p>
        )}
      </div>

      {canBlock ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="block"
            defaultChecked={state.values ? state.values.block === "on" : true}
            className="mt-0.5 size-6 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {t("user.block", { name: name ?? "" })}
            </span>
            <span className="text-xs leading-snug text-text-muted">{t("user.blockHint")}</span>
          </span>
        </label>
      ) : null}

      <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
    </form>
  );
}
