import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/i18n/client-messages";

export default async function ListingLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages(["common", "errorPage", "chat.errors", "chat.contact"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
