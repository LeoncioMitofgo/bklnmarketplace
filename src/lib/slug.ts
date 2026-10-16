// Slugs para URLs legibles en español: "Ciudad de la Paz" → "ciudad-de-la-paz", "Añisok" → "anisok".

export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}
