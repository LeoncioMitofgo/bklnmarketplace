import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import { BottomNav, BottomNavView } from "@/components/nav/bottom-nav";
import { pickMessages } from "@/i18n/client-messages";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const messages = await pickMessages([
    "common",
    "nav",
    "errorPage",
    "account",
    "listings.mine",
    "listings.errors",
    "push",
  ]);
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mx-auto min-h-dvh max-w-md pb-24">{children}</div>
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
    </NextIntlClientProvider>
  );
}
