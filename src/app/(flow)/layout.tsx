import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/i18n/client-messages";

// Flujos a pantalla completa (publicar): sin barra inferior, como en los wireframes 08 y 09.
export default async function FlowLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages(["common", "listings", "price", "account"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <main className="mx-auto min-h-dvh max-w-md">{children}</main>
    </NextIntlClientProvider>
  );
}
