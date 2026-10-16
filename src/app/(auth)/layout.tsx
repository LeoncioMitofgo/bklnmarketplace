import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/i18n/client-messages";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages(["common", "auth"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <main className="mx-auto min-h-dvh max-w-md px-5 pb-10">{children}</main>
    </NextIntlClientProvider>
  );
}
