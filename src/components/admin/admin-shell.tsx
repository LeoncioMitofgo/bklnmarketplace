import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Marco del panel (wireframe 13): pensado para el móvil, con pestañas arriba en lugar de la barra
// inferior. Se pinta solo después de comprobar el rol de admin (requireAdmin).

const TABS = [
  { key: "home", href: "/admin" },
  { key: "payments", href: "/admin/pagos" },
  { key: "reports", href: "/admin/denuncias" },
  { key: "users", href: "/admin/usuarios" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

export async function AdminShell({
  active,
  children,
}: {
  active: AdminTab;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.nav");
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Link href="/admin" className="font-display text-lg font-extrabold text-primary">
          {t("title")}
        </Link>
        <Link href="/" className="flex min-h-11 items-center text-sm font-semibold text-primary">
          {t("site")}
        </Link>
      </header>
      <nav
        aria-label={t("label")}
        className="flex gap-1 overflow-x-auto border-b border-border px-2"
      >
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm ${
              tab.key === active ? "border-primary font-bold text-primary" : "border-transparent"
            }`}
          >
            {t(tab.key)}
          </Link>
        ))}
      </nav>
      <main className="flex flex-col gap-5 px-4 py-5">{children}</main>
    </>
  );
}

/** Esqueleto mientras se comprueba el rol y se cargan los datos. */
export function AdminSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="h-14 border-b border-border" />
      <div className="h-11 border-b border-border" />
      <div className="m-4 h-40 rounded-card bg-surface" />
    </div>
  );
}
