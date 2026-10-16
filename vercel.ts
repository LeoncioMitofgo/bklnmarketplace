import type { VercelConfig } from "@vercel/config/v1";

// El proyecto de Vercel se creó sin framework: se fija aquí.
// Funciones en Londres, junto a la base de datos de producción (D-016).
export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["lhr1"],
};
