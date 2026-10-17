import { getFormatter, getTranslations } from "next-intl/server";

type User = {
  status: string;
  role: string;
  premium_until: string | null;
  suspended_until: string | null;
  open_reports: number;
};

/** Etiquetas de estado de un usuario en el panel: admin, Premium, suspendido, baneado, denuncias. */
export async function UserBadges({ user }: { user: User }) {
  const [t, format] = await Promise.all([getTranslations("admin.users.badges"), getFormatter()]);
  const now = Date.now();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  const badges: { key: string; label: string; tone: string }[] = [];
  if (user.role === "admin")
    badges.push({ key: "admin", label: t("admin"), tone: "bg-primary text-white" });
  if (user.premium_until && Date.parse(user.premium_until) > now) {
    badges.push({
      key: "premium",
      label: t("premium", { date: date(user.premium_until) }),
      tone: "bg-accent text-text",
    });
  }
  if (user.status === "banned")
    badges.push({ key: "banned", label: t("banned"), tone: "bg-danger text-white" });
  if (user.suspended_until && Date.parse(user.suspended_until) > now) {
    badges.push({
      key: "suspended",
      label: t("suspended", { date: date(user.suspended_until) }),
      tone: "bg-danger text-white",
    });
  }
  if (user.open_reports > 0) {
    badges.push({
      key: "reports",
      label: t("reports", { count: user.open_reports }),
      tone: "bg-surface text-danger",
    });
  }
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5 pt-0.5">
      {badges.map((b) => (
        <span key={b.key} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${b.tone}`}>
          {b.label}
        </span>
      ))}
    </span>
  );
}
