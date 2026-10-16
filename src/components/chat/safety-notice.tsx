import { getTranslations } from "next-intl/server";
import { ShieldCheckIcon } from "@/components/icons";

/** Aviso anti‑estafa al principio de cada conversación (ALCANCE §4.5, IDENTIDAD §6). */
export async function ChatSafetyNotice() {
  const t = await getTranslations("chat.conversation");
  return (
    <p className="mb-2 flex gap-2 rounded-card bg-surface px-3 py-2.5 text-xs leading-relaxed text-text-muted">
      <ShieldCheckIcon className="size-5 shrink-0 text-success" />
      {t("safety")}
    </p>
  );
}
