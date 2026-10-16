import "server-only";
import { getTranslations } from "next-intl/server";
import type { EmailMessage } from "./send";

// Los emails necesitan estilos en línea: estos valores son copia de los tokens de IDENTIDAD §3.
const COLORS = {
  primary: "#0b4f8a",
  text: "#0f172a",
  muted: "#475569",
  surface: "#f3f6fa",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type ActionEmail = {
  to: string;
  subject: string;
  greeting: string;
  body: string;
  button: string;
  url: string;
  expiry: string;
  footer: string;
};

function renderActionEmail(email: ActionEmail): EmailMessage {
  const url = escapeHtml(email.url);
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px 16px;background:${COLORS.surface};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${COLORS.text}">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800;color:${COLORS.primary}">bkln<span style="font-weight:500">marketplace</span></p>
<p style="margin:0 0 12px;font-size:16px">${escapeHtml(email.greeting)}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapeHtml(email.body)}</p>
<a href="${url}" style="display:inline-block;background:${COLORS.primary};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px">${escapeHtml(email.button)}</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(email.expiry)}</p>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all">${url}</p>
</div>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;color:${COLORS.muted};text-align:center">${escapeHtml(email.footer)}</p>
</body></html>`;

  const text = [
    email.greeting,
    "",
    email.body,
    "",
    `${email.button}: ${email.url}`,
    "",
    email.expiry,
  ]
    .concat(["", email.footer])
    .join("\n");

  return { to: email.to, subject: email.subject, html, text };
}

export async function verifyEmailMessage(to: string, name: string, url: string) {
  const t = await getTranslations("emails");
  return renderActionEmail({
    to,
    subject: t("verify.subject"),
    greeting: t("verify.greeting", { name }),
    body: t("verify.body"),
    button: t("verify.button"),
    expiry: t("verify.expiry"),
    footer: t("footer"),
    url,
  });
}

export async function resetPasswordMessage(to: string, name: string, url: string) {
  const t = await getTranslations("emails");
  return renderActionEmail({
    to,
    subject: t("reset.subject"),
    greeting: t("reset.greeting", { name }),
    body: t("reset.body"),
    button: t("reset.button"),
    expiry: t("reset.expiry"),
    footer: t("footer"),
    url,
  });
}
