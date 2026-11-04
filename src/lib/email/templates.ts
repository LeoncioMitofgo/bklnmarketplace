import "server-only";
import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/site";
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

/** A, B y 2 más: una lista corta, sin alargar el email. */
function shortList(items: string[], more: (count: number) => string): string {
  const shown = items.slice(0, 3);
  if (items.length > 3) shown.push(more(items.length - 3));
  return new Intl.ListFormat("es", { type: "conjunction" }).format(shown);
}

/** «A», «B» y 2 más: los títulos de los anuncios. */
const titleList = (titles: string[], more: (count: number) => string) =>
  shortList(
    titles.map((t) => `«${t}»`),
    more,
  );

export async function listingExpiryMessage(
  to: string,
  name: string,
  listings: { expiring: string[]; expired: string[]; days: number },
) {
  const t = await getTranslations("emails.expiry");
  const more = (count: number) => t("more", { count });
  const body = [
    listings.expiring.length
      ? t("expiringBody", {
          count: listings.expiring.length,
          titles: titleList(listings.expiring, more),
          days: listings.days,
        })
      : null,
    listings.expired.length
      ? t("expiredBody", {
          count: listings.expired.length,
          titles: titleList(listings.expired, more),
        })
      : null,
  ].filter(Boolean);
  return renderActionEmail({
    to,
    subject: listings.expiring.length
      ? t("expiringSubject", { count: listings.expiring.length })
      : t("expiredSubject", { count: listings.expired.length }),
    greeting: t("greeting", { name }),
    body: body.join(" "),
    button: t("button"),
    expiry: t("note", { days: listings.days }),
    footer: (await getTranslations("emails"))("footer"),
    url: `${siteUrl()}/mis-anuncios`,
  });
}

export async function unreadMessagesMessage(
  to: string,
  name: string,
  conversations: { id: string; sender: string; listing: string | null; preview: string | null }[],
  minutes: number,
) {
  const t = await getTranslations("emails.unread");
  const sender = (value: string) => value || t("someone");
  const [first] = conversations;
  const single = conversations.length === 1;
  const body = single
    ? [
        first.listing
          ? t("oneAbout", { sender: sender(first.sender), listing: first.listing })
          : t("one", { sender: sender(first.sender) }),
        first.preview ? t("preview", { preview: first.preview }) : t("photo"),
      ].join(" ")
    : t("many", {
        senders: shortList([...new Set(conversations.map((c) => sender(c.sender)))], (count) =>
          t("more", { count }),
        ),
      });
  return renderActionEmail({
    to,
    subject: single
      ? t("subjectOne", { sender: sender(first.sender) })
      : t("subjectMany", { count: conversations.length }),
    greeting: t("greeting", { name }),
    body,
    button: single ? t("buttonOne") : t("buttonMany"),
    expiry: t("note", { minutes }),
    footer: (await getTranslations("emails"))("footer"),
    url: single ? `${siteUrl()}/mensajes/${first.id}` : `${siteUrl()}/mensajes`,
  });
}
