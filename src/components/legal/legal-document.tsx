import { getTranslations } from "next-intl/server";

// Términos y privacidad (ALCANCE §7). El texto vive en es.json (legal.terms / legal.privacy) como
// secciones con párrafos (texto) y listas (arrays de textos), para poder traducirlo al francés.

type Block = string | string[];
type Section = { id: string; title: string; blocks: Block[] };

const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/** Convierte en enlace los emails de contacto que aparecen en el texto. */
function withEmailLinks(text: string) {
  return text.split(EMAIL).map((part, index) =>
    index % 2 === 1 ? (
      <a key={part} href={`mailto:${part}`} className="font-semibold text-primary underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export async function LegalDocument({ doc }: { doc: "terms" | "privacy" }) {
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as Section[];

  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold">{t(`${doc}.title`)}</h1>
        <p className="text-sm text-text-muted">{t("updated")}</p>
      </header>
      <p className="text-[15px] leading-relaxed">{t(`${doc}.intro`)}</p>

      <nav aria-labelledby="legal-contents" className="rounded-card bg-surface p-4">
        <h2 id="legal-contents" className="mb-1 font-sans text-sm font-bold">
          {t("contents")}
        </h2>
        <ol className="flex flex-col text-sm">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="flex min-h-10 items-center text-primary">
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-4 flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">
            {index + 1}. {section.title}
          </h2>
          {section.blocks.map((block) =>
            typeof block === "string" ? (
              <p key={block} className="text-[15px] leading-relaxed">
                {withEmailLinks(block)}
              </p>
            ) : (
              <ul
                key={block[0]}
                className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed"
              >
                {block.map((item) => (
                  <li key={item}>{withEmailLinks(item)}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}

      <p className="border-t border-border pt-4 text-xs text-text-muted">{t("footer")}</p>
    </main>
  );
}
