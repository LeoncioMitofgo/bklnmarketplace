"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { inputClasses } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { activatePremium } from "@/lib/admin/actions";
import type { AdminActionState } from "@/lib/admin/types";
import { formatNumber, TIME_ZONE } from "@/lib/format";

type Props = {
  userId: string;
  username: string;
  /** Fin del Premium actual (ISO) si sigue activo: el periodo nuevo empieza ahí. */
  premiumUntil: string | null;
  prices: { months: number; price_xaf: number; label: string }[];
  methods: { value: string; label: string }[];
  defaults: { months: number; method: string };
  labels: {
    months: string;
    amount: string;
    method: string;
    reference: string;
    referenceHint: string;
    notes: string;
    /** Con {date}. */
    until: string;
    submit: string;
    submitting: string;
  };
};

/**
 * Registrar un cobro y activar Premium (wireframe 13: "fecha de fin calculada"). El importe se
 * rellena con el precio del periodo y se puede cambiar; la fecha de fin se recalcula al momento.
 */
export function PremiumActivateForm(props: Props) {
  const { userId, username, premiumUntil, prices, methods, defaults, labels } = props;
  const [state, action] = useActionState(activatePremium, {} as AdminActionState);
  const priceOf = (months: number) => prices.find((p) => p.months === months)?.price_xaf ?? 0;
  const [months, setMonths] = useState(defaults.months);
  const [amount, setAmount] = useState(String(priceOf(defaults.months)));

  const start = Math.max(Date.now(), premiumUntil ? Date.parse(premiumUntil) : 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const endLabel = new Intl.DateTimeFormat("es", {
    dateStyle: "short",
    timeZone: TIME_ZONE,
  }).format(end);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message ? (
        <Alert tone={state.status === "ok" ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="username" value={username} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="premium-months" className="text-sm font-semibold">
            {labels.months}
          </label>
          <select
            id="premium-months"
            name="months"
            value={months}
            onChange={(event) => {
              const next = Number(event.target.value);
              setMonths(next);
              setAmount(String(priceOf(next)));
            }}
            className={inputClasses()}
          >
            {prices.map((p) => (
              <option key={p.months} value={p.months}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="premium-amount" className="text-sm font-semibold">
            {labels.amount}
          </label>
          <input
            id="premium-amount"
            name="amount"
            inputMode="numeric"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            className={inputClasses()}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-text-muted">{formatNumber(Number(amount) || 0)} FCFA</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="premium-method" className="text-sm font-semibold">
          {labels.method}
        </label>
        <select
          id="premium-method"
          name="method"
          defaultValue={defaults.method}
          className={inputClasses()}
        >
          {methods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="premium-reference" className="text-sm font-semibold">
          {labels.reference}
        </label>
        <input
          id="premium-reference"
          name="reference"
          required
          maxLength={60}
          autoCapitalize="characters"
          autoComplete="off"
          aria-describedby="premium-reference-hint"
          className={inputClasses()}
        />
        <p id="premium-reference-hint" className="text-xs text-text-muted">
          {labels.referenceHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="premium-notes" className="text-sm font-semibold">
          {labels.notes}
        </label>
        <textarea
          id="premium-notes"
          name="notes"
          rows={2}
          maxLength={500}
          className={inputClasses("py-3")}
        />
      </div>

      <p className="rounded-control bg-surface px-3.5 py-3 text-sm font-semibold">
        {labels.until.replace("{date}", endLabel)}
      </p>
      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} variant="accent" />
    </form>
  );
}
