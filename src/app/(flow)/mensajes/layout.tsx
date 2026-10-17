import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/i18n/client-messages";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages(["common", "errorPage", "chat", "push"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
