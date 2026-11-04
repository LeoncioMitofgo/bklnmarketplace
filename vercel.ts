import type { VercelConfig } from "@vercel/config/v1";

// El proyecto de Vercel se creó sin framework: se fija aquí.
// Funciones en Dublín, junto a la base de datos de producción en Irlanda (D-067).
export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["dub1"],
  // Avisos programados (D-061): a las 08:00 UTC, las 09:00 en Malabo. El plan Hobby permite uno al día.
  crons: [{ path: "/api/cron/daily", schedule: "0 8 * * *" }],
};
