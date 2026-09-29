export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <p className="mb-8 text-center text-2xl font-semibold tracking-tight">Rückblick</p>
      {children}
    </main>
  );
}
