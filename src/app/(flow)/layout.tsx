// Flujos a pantalla completa (publicar): sin barra inferior, como en los wireframes 08 y 09.
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-md">{children}</main>;
}
