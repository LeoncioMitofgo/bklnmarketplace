import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { UserBadges } from "@/components/admin/user-badges";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { inputClasses } from "@/components/ui/field";
import { requireAdmin } from "@/lib/admin/auth";
import { formatGqPhone } from "@/lib/format";

// Usuarios: buscar por nombre, @usuario, email o teléfono. Sin búsqueda, los más recientes.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminUsers searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminUsers({ searchParams }: Pick<PageProps<"/admin/usuarios">, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const { supabase } = await requireAdmin("/admin/usuarios");
  const [{ data, error }, t] = await Promise.all([
    supabase.rpc("admin_users", { p_query: query || undefined, p_limit: 50 }),
    getTranslations("admin.users"),
  ]);
  if (error) throw new Error(`admin_users: ${error.message}`);

  return (
    <AdminShell active="users">
      <h1 className="text-xl font-extrabold">{t("title")}</h1>
      <Form action="/admin/usuarios" replace className="flex gap-2">
        <label htmlFor="admin-user-search" className="sr-only">
          {t("search")}
        </label>
        <input
          id="admin-user-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          autoCapitalize="none"
          className={inputClasses()}
        />
        <button
          type="submit"
          aria-label={t("search")}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-control bg-primary text-white"
        >
          <SearchIcon className="size-5" />
        </button>
      </Form>
      <p className="text-sm text-text-muted">
        {query ? t("results", { count: data.length }) : t("latest")}
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
        {data.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-bold">
                  {u.display_name}{" "}
                  <span className="font-normal text-text-muted">@{u.username}</span>
                </span>
                <span className="truncate text-sm text-text-muted">
                  {u.email} · {formatGqPhone(u.phone)}
                </span>
                <UserBadges user={u} />
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
