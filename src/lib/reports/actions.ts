"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/session";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  LISTING_REPORT_REASONS,
  REPORT_DETAILS_MAX,
  type ReportState,
  USER_REPORT_REASONS,
} from "./types";

// Denuncias (ALCANCE §5.5). Errores: claves bajo report.errors. Las RPC lanzan P0001 con la clave.

type Reason = Database["public"]["Enums"]["report_reason"];

const RPC_ERRORS = new Set([
  "not_authenticated",
  "account_restricted",
  "listing_not_available",
  "own_listing",
  "report_invalid",
  "report_rate_limited",
  "conversation_not_found",
  "recipient_deleted",
]);

const isUuid = (value: string) => /^[0-9a-f-]{36}$/.test(value);

function parse(formData: FormData, reasons: readonly [Reason, ...Reason[]]) {
  return z
    .object({
      reason: z.enum(reasons, { error: "reason_required" }),
      details: z.string().trim().max(REPORT_DETAILS_MAX, { error: "details_too_long" }),
    })
    .refine((value) => value.reason !== "other" || value.details.length > 0, {
      error: "details_required",
      path: ["details"],
    })
    .safeParse({
      reason: formData.get("reason") ?? undefined,
      details: String(formData.get("details") ?? ""),
    });
}

/** Sin sesión, a entrar y de vuelta al formulario (ALCANCE §4.3). */
async function requireUser(formData: FormData) {
  const user = await getSessionUser();
  if (!user) {
    const back = safeNextPath(String(formData.get("returnTo") ?? ""), "/");
    redirect(`/entrar?next=${encodeURIComponent(back)}`);
  }
  return user;
}

function failed(
  error: { code?: string; message: string } | null,
  values: ReportState["values"],
): ReportState {
  if (error?.code === "P0001" && RPC_ERRORS.has(error.message)) {
    return { status: "error", error: error.message, values };
  }
  console.error("report_error", error?.code, error?.message);
  return { status: "error", error: "unexpected", values };
}

export async function reportListing(_prev: ReportState, formData: FormData): Promise<ReportState> {
  await requireUser(formData);
  const values = {
    reason: String(formData.get("reason") ?? ""),
    details: String(formData.get("details") ?? ""),
  };
  const listingId = String(formData.get("listingId") ?? "");
  if (!isUuid(listingId)) return { status: "error", error: "listing_not_available", values };

  const input = parse(formData, LISTING_REPORT_REASONS);
  if (!input.success) {
    return { status: "error", error: input.error.issues[0]?.message ?? "unexpected", values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_listing", {
    p_listing_id: listingId,
    p_reason: input.data.reason,
    p_details: input.data.details || undefined,
  });
  if (error || !data) return failed(error, values);

  // Esta denuncia lo ha ocultado: fuera del inicio, la búsqueda, la ficha y el perfil.
  if (data === "hidden") updateTag(LISTINGS_TAG);
  return { status: "done", result: data };
}

export async function reportConversation(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  await requireUser(formData);
  const values = {
    reason: String(formData.get("reason") ?? ""),
    details: String(formData.get("details") ?? ""),
    block: formData.get("block") === "on" ? "on" : "",
  };
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!isUuid(conversationId)) return { status: "error", error: "conversation_not_found", values };

  const input = parse(formData, USER_REPORT_REASONS);
  if (!input.success) {
    return { status: "error", error: input.error.issues[0]?.message ?? "unexpected", values };
  }

  const block = values.block === "on";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_conversation", {
    p_conversation_id: conversationId,
    p_reason: input.data.reason,
    p_details: input.data.details || undefined,
    p_block: block,
  });
  if (error || !data) return failed(error, values);
  // La conversación ya cacheada en el navegador tiene que enterarse del bloqueo.
  if (block) refresh();
  return { status: "done", result: data, blocked: block };
}
