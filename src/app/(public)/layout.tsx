import Link from "next/link";

/** Seiten, die ohne Anmeldung erreichbar sind: Datenschutzinformation und Impressum. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/" className="mb-8 block text-lg font-semibold tracking-tight">
        LimeJournal
      </Link>
      <article className="space-y-6 leading-relaxed [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:text-accent-ink [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_section]:space-y-3">
        {children}
      </article>
    </main>
  );
}
