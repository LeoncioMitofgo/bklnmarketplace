import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Marco del panel (wireframe 13). En el móvil, pestañas arriba en lugar de la barra inferior; en
// pantallas anchas (portátil u ordenador, D-071), menú a la izquierda y el contenido a lo ancho.
// Se pinta solo después de comprobar el rol de admin (requireAdmin).

const TABS = [
  { key: "home", href: "/admin" },
  { key: "payments", href: "/admin/pagos" },
  { key: "reports", href: "/admin/denuncias" },
  { key: "users", href: "/admin/usuarios" },
  { key: "catalog", href: "/admin/catalogo" },
  { key: "settings", href: "/admin/ajustes" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

export async function AdminShell({
  active,
  narrow = false,
  children,
}: {
  active: AdminTab;
  /** Páginas de un solo formulario: en pantallas anchas no se estiran a todo el ancho. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.nav");
  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-border">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:border-b-0 lg:px-5 lg:py-5">
          <Link href="/admin" className="font-display text-lg font-extrabold text-primary">
            {t("title")}
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center text-sm font-semibold text-primary lg:hidden"
          >
            {t("site")}
          </Link>
        </header>
        <nav
          aria-label={t("label")}
          className="flex gap-1 overflow-x-auto border-b border-border px-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-3"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === active ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm lg:rounded-control lg:border-b-0 ${
                tab.key === active
                  ? "border-primary font-bold text-primary lg:bg-surface"
                  : "border-transparent lg:hover:bg-surface"
              }`}
            >
              {t(tab.key)}
            </Link>
          ))}
        </nav>
        <Link
          href="/"
          className="hidden min-h-11 items-center px-6 pb-5 text-sm font-semibold text-primary lg:flex"
        >
          {t("site")}
        </Link>
      </aside>
      <main
        className={`flex flex-col gap-5 px-4 py-5 lg:min-w-0 lg:flex-1 lg:px-10 lg:py-8 ${
          narrow ? "lg:max-w-2xl" : "lg:max-w-6xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Dos columnas en pantallas anchas; en el móvil, una debajo de otra y en el mismo orden.
 * Cada hijo es una columna (usar AdminColumn para agrupar varias secciones).
 */
export function AdminColumns({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      {children}
    </div>
  );
}

/** Una columna de AdminColumns. Con `sticky`, se queda a la vista al bajar (formularios de acción). */
export function AdminColumn({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-5 ${sticky ? "lg:sticky lg:top-8" : ""}`}>
      {children}
    </div>
  );
}

/** Esqueleto mientras se comprueba el rol y se cargan los datos. */
export function AdminSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col lg:flex-row">
      <div className="h-14 border-b border-border lg:h-dvh lg:w-56 lg:border-r lg:border-b-0" />
      <div className="h-11 border-b border-border lg:hidden" />
      <div className="m-4 h-40 rounded-card bg-surface lg:m-10 lg:flex-1" />
    </div>
  );
}
