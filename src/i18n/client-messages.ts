import "server-only";
import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Solo los textos que usan los componentes de cliente de una zona ("auth", "listings.errors"…).
 * Así cada página no lleva en su HTML el es.json entero (ALCANCE §7: poco peso en 3G).
 */
export async function pickMessages(paths: string[]): Promise<AbstractIntlMessages> {
  const all = await getMessages();
  const picked: Record<string, AbstractIntlMessages | string> = {};
  for (const path of paths) {
    const [namespace, key] = path.split(".");
    const value = all[namespace];
    if (key === undefined) {
      picked[namespace] = value;
    } else if (typeof value === "object") {
      picked[namespace] = { ...(picked[namespace] as AbstractIntlMessages), [key]: value[key] };
    }
  }
  return picked;
}
