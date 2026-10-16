import { getRequestConfig } from "next-intl/server";
import { TIME_ZONE } from "@/lib/format";

// Solo español por ahora y sin prefijo de idioma en la URL (D-007). El francés se añadirá en la fase 2.
export const LOCALE = "es";

export default getRequestConfig(async () => ({
  locale: LOCALE,
  timeZone: TIME_ZONE,
  messages: (await import(`../messages/${LOCALE}.json`)).default,
}));
