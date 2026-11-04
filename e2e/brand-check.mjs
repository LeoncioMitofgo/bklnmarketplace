// Marca y web instalable (D-063): iconos, manifiesto, Open Graph y logo en las cabeceras.
import { mkdtempSync } from "node:fs";
import { BASE, CHROMIUM_PATH, chromium, env, finish, ok, TMP, watchErrors } from "./lib.mjs";

const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

// Ficheros servidos
const files = {
  "/icon.svg": ["image/svg+xml"],
  "/apple-icon.png": ["image/png", 180, 180],
  "/opengraph-image.png": ["image/png", 1200, 630],
  "/icons/icon-192.png": ["image/png", 192, 192],
  "/icons/icon-512.png": ["image/png", 512, 512],
  "/icons/icon-maskable-512.png": ["image/png", 512, 512],
  "/icons/badge-96.png": ["image/png", 96, 96],
};
for (const [path, [type, w, h]] of Object.entries(files)) {
  const res = await fetch(`${BASE}${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sizeOk = !w || (pngSize(buf)[0] === w && pngSize(buf)[1] === h);
  ok(
    `${path} responde con ${type}${w ? ` de ${w}×${h}` : ""}`,
    res.ok && res.headers.get("content-type")?.startsWith(type) && sizeOk,
    `${res.status} ${res.headers.get("content-type")} ${w ? pngSize(buf) : ""}`,
  );
}
const svg = await (await fetch(`${BASE}/icon.svg`)).text();
ok("el favicon es el símbolo nuevo (la b con la etiqueta)", svg.includes("A15 15 0 1 1 2.5 27Z"));

const manifestRes = await fetch(`${BASE}/manifest.webmanifest`);
const manifest = await manifestRes.json();
ok(
  "el manifiesto responde",
  manifestRes.ok && manifestRes.headers.get("content-type")?.includes("manifest"),
  manifestRes.headers.get("content-type"),
);
ok(
  "manifiesto: nombre, nombre corto e inicio",
  manifest.name === "BKLN Marketplace" &&
    manifest.short_name === "BKLN" &&
    manifest.start_url === "/" &&
    manifest.display === "standalone",
);
ok(
  "manifiesto: iconos 192, 512 y adaptable",
  manifest.icons.length === 3 && manifest.icons.some((i) => i.purpose === "maskable"),
);

// Con un perfil persistente: en incógnito Chrome nunca deja instalar.
const context = await chromium.launchPersistentContext(mkdtempSync(`${TMP}/pw-perfil-`), {
  executablePath: CHROMIUM_PATH,
  viewport: { width: 360, height: 740 },
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
watchErrors(page, errors, (url) => url.endsWith("/no-existe-esta-pagina"));
try {
  await page.goto(`${BASE}/`);
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
    icon: document.querySelector('link[rel="icon"]')?.getAttribute("href"),
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
    appleTitle: document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.getAttribute("content"),
    og: [...document.querySelectorAll('meta[property="og:image"]')].map((m) =>
      m.getAttribute("content"),
    ),
    ogAlt: document.querySelector('meta[property="og:image:alt"]')?.getAttribute("content"),
  }));
  ok("el inicio enlaza el manifiesto", head.manifest === "/manifest.webmanifest", head.manifest);
  ok(
    "el inicio enlaza el favicon y el icono del iPhone",
    head.icon?.startsWith("/icon.svg") && head.apple?.startsWith("/apple-icon.png"),
    `${head.icon} ${head.apple}`,
  );
  ok("nombre bajo el icono en el iPhone: BKLN", head.appleTitle === "BKLN", head.appleTitle);
  ok(
    "el inicio comparte la imagen de la marca",
    head.og.length === 1 && head.og[0].includes("/opengraph-image.png"),
    head.og.join(" "),
  );
  ok(
    "la imagen para compartir tiene texto alternativo",
    head.ogAlt?.includes("Guinea Ecuatorial"),
    head.ogAlt,
  );

  // Chrome la considera instalable.
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  ok(
    "Chrome la puede instalar",
    installabilityErrors.length === 0,
    JSON.stringify(installabilityErrors),
  );
  const { errors: manifestErrors } = await cdp.send("Page.getAppManifest");
  ok(
    "el manifiesto no tiene errores para Chrome",
    manifestErrors.length === 0,
    JSON.stringify(manifestErrors),
  );

  // Logo nuevo en la cabecera.
  ok(
    "la cabecera lleva el símbolo nuevo",
    (await page
      .locator('header svg path[d*="A15 15 0 1 1 2.5 27Z"]')
      .filter({ visible: true })
      .count()) === 1,
  );
  // Aviso de versión previa (D-066): se ve mientras la web no se deja indexar.
  const preview = await page.getByText("Versión previa.").filter({ visible: true }).count();
  ok(
    env.SITE_INDEXABLE === "true"
      ? "sin aviso de versión previa (la web ya se indexa)"
      : "el inicio avisa de que es una versión previa con anuncios de demostración",
    env.SITE_INDEXABLE === "true" ? preview === 0 : preview === 1,
    `${preview} avisos`,
  );
  await page.screenshot({
    path: `${TMP}/brand/inicio.png`,
    clip: { x: 0, y: 0, width: 360, height: 200 },
  });

  // Un anuncio comparte su foto, no la de la marca.
  const href = await page.locator('a[href^="/anuncio/"]').first().getAttribute("href");
  await page.goto(`${BASE}${href}`);
  const listingOg = await page.evaluate(() =>
    [...document.querySelectorAll('meta[property="og:image"]')].map((m) =>
      m.getAttribute("content"),
    ),
  );
  ok(
    "un anuncio comparte la foto del anuncio",
    listingOg.length === 1 && !listingOg[0].includes("opengraph-image"),
    listingOg.join(" "),
  );

  // Un perfil (sin Open Graph propio) usa la imagen de la marca.
  await page.goto(`${BASE}/u/julio_nkulu`);
  const profileOg = await page.evaluate(() =>
    [...document.querySelectorAll('meta[property="og:image"]')].map((m) =>
      m.getAttribute("content"),
    ),
  );
  ok(
    "un perfil comparte la imagen de la marca",
    profileOg.some((u) => u.includes("/opengraph-image.png")),
    profileOg.join(" "),
  );

  await page.goto(`${BASE}/entrar`);
  const authSymbol = page.locator('svg path[d*="A15 15 0 1 1 2.5 27Z"]').filter({ visible: true });
  ok("entrar lleva el logo nuevo", (await authSymbol.count()) === 1);
  await page.screenshot({
    path: `${TMP}/brand/entrar.png`,
    clip: { x: 0, y: 0, width: 360, height: 200 },
  });

  await page.goto(`${BASE}/no-existe-esta-pagina`);
  await page.screenshot({
    path: `${TMP}/brand/404.png`,
    clip: { x: 0, y: 0, width: 360, height: 300 },
  });
  ok("sin errores en la consola", errors.length === 0, errors.join(" | "));
} finally {
  await context.close();
}
finish();
