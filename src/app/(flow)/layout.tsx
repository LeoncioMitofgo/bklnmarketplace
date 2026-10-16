// Pantallas completas sin barra inferior: publicar (wireframes 08 y 09), ficha (04) y conversación (11).
// Cada zona añade los textos de sus componentes de cliente en su propio layout.
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
}
