// `pnpm e2e <prueba> [argumentos]` lanza una prueba; `pnpm e2e todas`, todas seguidas (ver README.md).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const tests = readdirSync(DIR)
  .filter((f) => f.endsWith("-check.mjs"))
  .map((f) => f.replace(/\.mjs$/, ""));
// push-check necesita Google Chrome instalado y avisos de FCM, y monitoring-check, el servidor
// compilado con SENTRY_DSN; se lanzan aparte.
const SEPARATE = new Set(["push-check", "monitoring-check"]);

const [name, ...args] = process.argv.slice(2);
const run = (test, testArgs = []) =>
  spawnSync(process.execPath, [`${DIR}/${test}.mjs`, ...testArgs], { stdio: "inherit" }).status;

if (name === "todas") {
  const failed = [];
  for (const test of tests.filter((t) => !SEPARATE.has(t))) {
    console.log(`\n━━ ${test}`);
    if (run(test) !== 0) failed.push(test);
  }
  console.log(failed.length ? `\nFallaron: ${failed.join(", ")}` : "\nTodas las pruebas OK");
  process.exit(failed.length ? 1 : 0);
}

if (!tests.includes(name)) {
  console.log(`Uso: pnpm e2e <prueba> | pnpm e2e todas\nPruebas: ${tests.join(", ")}`);
  process.exit(name ? 1 : 0);
}
process.exit(run(name, args));
