import type { Database } from "@/lib/supabase/database.types";

type Reason = Database["public"]["Enums"]["report_reason"];

/** Motivos al denunciar un anuncio (ALCANCE §5.5), en el orden en que se muestran. */
export const LISTING_REPORT_REASONS = [
  "scam",
  "prohibited",
  "duplicate",
  "wrong_category",
  "offensive",
  "other",
] as const satisfies readonly [Reason, ...Reason[]];

/** Motivos al denunciar a una persona desde el chat (la RPC rechaza los demás). */
export const USER_REPORT_REASONS = [
  "scam",
  "offensive",
  "prohibited",
  "other",
] as const satisfies readonly [Reason, ...Reason[]];

export const REPORT_DETAILS_MAX = 1000;

/**
 * Estado del formulario de denuncia. `error` es una clave bajo report.errors; `result` es lo que
 * devuelve la RPC (created · already · hidden). `values` devuelve lo escrito si hay un error.
 */
export type ReportState = {
  status: "idle" | "error" | "done";
  error?: string;
  result?: string;
  blocked?: boolean;
  values?: { reason?: string; details?: string; block?: string };
};

export const initialReportState: ReportState = { status: "idle" };
