import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { TextAreaField } from "@/components/admin/text-area-field";
import { closeReport } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { CHAT_IMAGES_BUCKET } from "@/lib/chat/types";

// Una denuncia hecha desde el chat (wireframe 13: "denuncias con acceso al chat denunciado").
// El admin solo puede leer conversaciones que tienen una denuncia (RLS).

const MESSAGES_LIMIT = 100;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.chatReport");
  return { title: t("title") };
}

export default function AdminChatReportPage({ params }: PageProps<"/admin/denuncias/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminChatReport params={params} />
    </Suspense>
  );
}

async function AdminChatReport({ params }: Pick<PageProps<"/admin/denuncias/[id]">, "params">) {
  const { id } = await params;
  const { supabase } = await requireAdmin(`/admin/denuncias/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: report } = await supabase
    .from("reports")
    .select(
      "id, reason, details, status, created_at, resolution_note, conversation_id, reported:profiles!reports_reported_user_id_fkey(id, username, display_name), reporter:profiles!reports_reporter_id_fkey(id, username, display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();

  const [conversation, messages, t, tReasons, format] = await Promise.all([
    report.conversation_id
      ? supabase
          .from("conversations")
          .select("listing:listings(title)")
          .eq("id", report.conversation_id)
          .maybeSingle()
      : null,
    report.conversation_id
      ? supabase
          .from("messages")
          .select("id, sender_id, body, image_path, created_at")
          .eq("conversation_id", report.conversation_id)
          .order("id", { ascending: false })
          .limit(MESSAGES_LIMIT)
      : null,
    getTranslations("admin.chatReport"),
    getTranslations("admin.reasons"),
    getFormatter(),
  ]);
  const rows = [...(messages?.data ?? [])].reverse();
  const paths = rows.flatMap((m) => (m.image_path ? [m.image_path] : []));
  const signed = paths.length
    ? ((await supabase.storage.from(CHAT_IMAGES_BUCKET).createSignedUrls(paths, 3600)).data ?? [])
    : [];
  const imageUrls = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const nameOf = (senderId: string | null) =>
    senderId === report.reported?.id
      ? (report.reported?.display_name ?? "")
      : senderId === report.reporter?.id
        ? (report.reporter?.display_name ?? "")
        : t("deletedUser");

  return (
    <AdminShell active="reports">
      <Link href="/admin/denuncias" className="-mb-2 text-sm font-semibold text-primary">
        {t("back")}
      </Link>
      <section className="flex flex-col gap-2">
        <h1 className="text-lg font-extrabold">
          {report.reported
            ? t("heading", {
                name: report.reported.display_name,
                username: report.reported.username,
              })
            : t("deletedUser")}
        </h1>
        <p className="text-[15px] font-semibold">{tReasons(report.reason)}</p>
        {report.details ? (
          <p className="whitespace-pre-line break-words text-sm">{report.details}</p>
        ) : null}
        <p className="text-xs text-text-muted">
          {t("by", {
            username: report.reporter?.username ?? t("deletedUser"),
            date: format.dateTime(new Date(report.created_at), {
              dateStyle: "short",
              timeStyle: "short",
            }),
          })}
        </p>
        {conversation?.data?.listing?.title ? (
          <p className="text-sm text-text-muted">
            {t("about", { title: conversation.data.listing.title })}
          </p>
        ) : null}
        {report.reported ? (
          <Link
            href={`/admin/usuarios/${report.reported.id}`}
            className="text-sm font-semibold text-primary"
          >
            {t("userActions")}
          </Link>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("conversation")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noMessages")}</p>
        ) : (
          <ol className="flex flex-col gap-2 rounded-card bg-surface p-3">
            {rows.map((m) => (
              <li
                key={m.id}
                className={`flex max-w-[85%] flex-col gap-1 rounded-card px-3 py-2 text-sm ${
                  m.sender_id === report.reported?.id
                    ? "self-start bg-bg"
                    : "self-end bg-primary text-white"
                }`}
              >
                <span className="text-xs font-bold opacity-80">
                  {nameOf(m.sender_id)} ·{" "}
                  {format.dateTime(new Date(m.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                {m.image_path && imageUrls.get(m.image_path) ? (
                  // biome-ignore lint/performance/noImgElement: foto del chat con URL firmada.
                  <img
                    src={imageUrls.get(m.image_path) ?? undefined}
                    alt={t("photo")}
                    className="max-h-60 rounded-control"
                  />
                ) : null}
                {m.body ? <span className="whitespace-pre-line break-words">{m.body}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border p-4">
        <h2 className="font-sans text-base font-bold">{t("closeTitle")}</h2>
        {/* El formulario sigue en la página al cerrar la denuncia, para conservar el mensaje. */}
        <AdminActionForm
          action={closeReport}
          pendingLabel={t("working")}
          buttons={
            report.status === "open"
              ? [
                  { label: t("resolve"), intent: "resolved" },
                  { label: t("dismiss"), intent: "dismissed", variant: "secondary" },
                ]
              : []
          }
        >
          <input type="hidden" name="reportId" value={report.id} />
          {report.status === "open" ? (
            <>
              <p className="text-sm text-text-muted">{t("closeHint")}</p>
              <TextAreaField id="close-note" name="note" label={t("note")} required={false} />
            </>
          ) : (
            <p className="rounded-control bg-surface px-3.5 py-3 text-sm">
              {t(`closed.${report.status}`, { note: report.resolution_note ?? "—" })}
            </p>
          )}
        </AdminActionForm>
      </section>
    </AdminShell>
  );
}
