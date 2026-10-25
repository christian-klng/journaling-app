import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Teilnahme beenden" };

export default async function EndParticipationPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Startseite
        </Link>
        <h1 className="text-xl font-semibold">Teilnahme beenden</h1>
      </div>

      <Card className="space-y-4">
        <p>
          Damit widerrufst du deine Einwilligung. Dein Konto <strong>{user.displayName}</strong>, alle
          Einträge, Aufnahmen und Transkripte werden sofort und endgültig gelöscht. Das lässt sich nicht
          rückgängig machen.
        </p>
        <p className="text-sm text-muted">
          Die Studienleitung erfährt nur deinen Fantasienamen und Code, damit sie dich auch aus bereits
          exportierten Daten entfernt. Was schon anonymisiert in Ergebnisse eingeflossen ist, bleibt
          bestehen. Nachteile entstehen dir keine. Mehr dazu in der{" "}
          <Link href="/datenschutz" className="text-accent-ink underline underline-offset-4">
            Datenschutzinformation
          </Link>
          .
        </p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}
