"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { type PremiumRequestState, requestPremium } from "@/lib/premium/actions";

type Option = { value: string; title: string; detail?: string; badge?: string };

type Props = {
  periods: Option[];
  methods: Option[];
  defaults: { months?: string; method?: string };
  labels: {
    period: string;
    method: string;
    submit: string;
    submitting: string;
    /** premium.errors, ya traducidos. */
    errors: Record<string, string>;
  };
};

/** Elegir periodo y forma de pago (wireframe 12). Funciona sin JavaScript: es un formulario normal. */
export function PremiumRequestForm({ periods, methods, defaults, labels }: Props) {
  const [state, action] = useActionState(requestPremium, {} as PremiumRequestState);
  const months = state.values?.months ?? defaults.months;
  const method = state.values?.method ?? defaults.method;

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <Alert tone="error">{labels.errors[state.error] ?? labels.errors.unexpected}</Alert>
      ) : null}
      <Choices name="months" legend={labels.period} options={periods} checked={months} />
      <Choices name="method" legend={labels.method} options={methods} checked={method} />
      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} variant="accent" />
    </form>
  );
}

function Choices({
  name,
  legend,
  options,
  checked,
}: {
  name: string;
  legend: string;
  options: Option[];
  checked?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-surface"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            required
            defaultChecked={checked === option.value}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
              {option.title}
              {option.badge ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
                  {option.badge}
                </span>
              ) : null}
            </span>
            {option.detail ? (
              <span className="text-xs leading-snug text-text-muted">{option.detail}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
