// Lo común de las pruebas de extremo a extremo (ver e2e/README.md): variables de .env.local,
// cliente de Supabase, Chromium y el recuento de comprobaciones.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

export { chromium, createClient };

export const PROJECT = fileURLToPath(new URL("..", import.meta.url))
  .replace(/\\/g, "/")
  .replace(/\/$/, "");

// La web contra la que se prueba: `pnpm start -p 3100` en local.
export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

// Fotos, capturas y perfiles del navegador que no van al repo.
export const TMP = `${tmpdir().replace(/\\/g, "/")}/bkln-e2e`;
mkdirSync(TMP, { recursive: true });

export const env = {
  ...Object.fromEntries(
    readFileSync(`${PROJECT}/.env.local`, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  ),
  ...process.env,
};
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
}

// Chromium completo (el headless-shell de Playwright no hace falta). E2E_CHROMIUM lo cambia; si no
// existe, Playwright busca el suyo (`pnpm exec playwright-core install chromium`).
const DEFAULT_CHROMIUM = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1234/chrome-win64/chrome.exe`;
export const CHROMIUM_PATH =
  process.env.E2E_CHROMIUM ?? (existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : undefined);

// Errores de JavaScript y peticiones fallidas de una página. El script de Vercel Analytics solo
// existe en Vercel; los 404 que se esperan se dejan pasar con allow404(url).
export function watchErrors(page, errors, allow404 = () => false) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      errors.push(`console: ${m.text()}`);
    }
  });
  page.on("response", (res) => {
    if (res.status() < 400 || res.url().includes("/_vercel/insights/")) return;
    if (res.status() === 404 && allow404(res.url())) return;
    errors.push(`${res.status()} ${res.url()}`);
  });
}

let failures = 0;

export function ok(label, cond, extra = "") {
  if (!cond) failures++;
  console.log(`${cond ? "OK   " : "FALLO"} ${label}${extra && !cond ? ` — ${extra}` : ""}`);
}

// Una excepción inesperada cuenta como fallo; la limpieza del finally sigue.
export function crash(error) {
  failures++;
  console.error("ERROR", error);
}

export function finish() {
  console.log(
    failures ? `\n${failures} comprobación(es) FALLARON` : "\nTodas las comprobaciones OK",
  );
  process.exit(failures ? 1 : 0);
}
