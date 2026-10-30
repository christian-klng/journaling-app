import Link from "next/link";

/** Auf jeder Seite, auch vor der Anmeldung: Studienbedingungen, Datenschutzinformation und Impressum. */
export function LegalFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl justify-center gap-4 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted">
      <Link href="/studienbedingungen" className="py-2 hover:text-foreground">
        Studienbedingungen
      </Link>
      <Link href="/datenschutz" className="py-2 hover:text-foreground">
        Datenschutz
      </Link>
      <Link href="/impressum" className="py-2 hover:text-foreground">
        Impressum
      </Link>
    </footer>
  );
}
