export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-md px-5 pb-10">{children}</main>;
}
