import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/i18n/client-messages";

export default async function PublishLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages(["common", "errorPage", "listings", "price", "account"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <main>{children}</main>
    </NextIntlClientProvider>
  );
}
