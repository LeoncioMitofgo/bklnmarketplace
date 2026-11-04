// Errores a Sentry (D-072) con un Sentry de mentira en localhost:4999 que guarda lo que le llega.
// El servidor tiene que estar compilado y arrancado con SENTRY_DSN=http://e2e@localhost:4999/1
// (el aviso del navegador se monta al compilar). Se lanza aparte de `pnpm e2e todas`.
import { createServer } from "node:http";
import { BASE, CHROMIUM_PATH, chromium, crash, finish, ok } from "./lib.mjs";

const envelopes = [];
const sentry = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => {
    body += c;
  });
  req.on("end", () => {
    envelopes.push({ url: req.url, auth: req.headers["x-sentry-auth"], body });
    res.writeHead(200).end("{}");
  });
}).listen(4999);

const id = Date.now().toString(36);
const events = () => envelopes.map((e) => JSON.parse(e.body.split("\n")[2]));
const waitFor = async (pred, ms = 6000) => {
  for (let t = 0; t < ms; t += 200) {
    if (events().some(pred)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  // La ruta de los avisos solo acepta peticiones de nuestras páginas y con su forma.
  const valid = { type: "Error", message: `e2e directo ${id}`, path: "/" };
  const post = (body, headers = {}) =>
    fetch(`${BASE}/api/errors`, { method: "POST", body: JSON.stringify(body), headers });
  ok("sin Origin → 403", (await post(valid)).status === 403);
  ok("desde otra web → 403", (await post(valid, { Origin: "https://otra.com" })).status === 403);
  ok("con otra forma → 400", (await post({ message: 1 }, { Origin: BASE })).status === 400);
  ok("bien hecha → 204", (await post(valid, { Origin: BASE })).status === 204);
  ok(
    "llega a Sentry con la clave del DSN",
    (await waitFor((e) => e.exception.values[0].value === valid.message)) &&
      envelopes.at(-1).url === "/api/1/envelope/" &&
      envelopes.at(-1).auth.includes("sentry_key=e2e"),
    "¿servidor arrancado con SENTRY_DSN=http://e2e@localhost:4999/1?",
  );

  // Un error de JavaScript en una página: lo manda el navegador, sin la query ni datos de más.
  const page = await browser.newPage({ viewport: { width: 360, height: 760 } });
  await page.goto(`${BASE}/buscar?q=secreto-${id}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const message = `e2e navegador ${id}`;
  const throwLater = (m) =>
    page.evaluate((m) => {
      setTimeout(() => {
        throw new Error(m);
      });
    }, m);
  await throwLater(message);
  await throwLater(message); // repetido: solo se manda una vez
  await page.evaluate(() =>
    setTimeout(() => {
      throw new TypeError("Failed to fetch");
    }),
  );
  const arrived = await waitFor((e) => e.exception.values[0].value === message);
  ok("el error del navegador llega a Sentry", arrived);
  await page.waitForTimeout(1500);
  const mine = events().filter((e) => e.exception.values[0].value === message);
  const e = mine[0];
  ok("una sola vez aunque se repita", mine.length === 1, String(mine.length));
  ok(
    "como error del navegador, con su pila y el navegador",
    e?.platform === "javascript" &&
      e.tags.source === "client" &&
      e.exception.values[0].stacktrace?.frames.length > 0 &&
      e.request.headers["User-Agent"]?.includes("Chrome"),
    JSON.stringify(e),
  );
  ok("la ruta sin la búsqueda", e?.request.url.endsWith("/buscar"), e?.request.url);
  const all = envelopes.map((x) => x.body).join("\n");
  ok("nada de la query ni de cookies", !all.includes(`secreto-${id}`) && !/cookie/i.test(all));
  ok(
    "los cortes de conexión no se mandan",
    !events().some((x) => x.exception.values[0].value === "Failed to fetch"),
  );
  await page.close();
} catch (error) {
  crash(error);
} finally {
  await browser.close();
  sentry.close();
}
finish();
