import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Diese Seite gibt es nicht</h1>
      <p className="text-muted">Vielleicht wurde der Eintrag entfernt oder der Link ist unvollständig.</p>
      <Link href="/" className={buttonClass("primary")}>
        Zur Startseite
      </Link>
    </main>
  );
}
