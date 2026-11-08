import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { CodeForm } from "./profile-forms";

export const metadata: Metadata = { title: "Persönlicher Code" };

export default async function ProfilePage() {
  const user = await requireUser();

  if (!user.codeStem) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Persönlicher Code</h1>
        <Notice>Bevor es weitergeht, bilde bitte einmal deinen persönlichen Code.</Notice>
        <CodeForm />
      </div>
    );
  }

  // Nur der Code-Anfang: Die Gruppe ordnet die Studienleitung im Hintergrund zu, Teilnehmende sehen sie nie
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Startseite
        </Link>
        <h1 className="text-xl font-semibold">Persönlicher Code</h1>
      </div>

      <Card className="space-y-4">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-muted">Benutzername</dt>
            <dd className="font-semibold">{user.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Persönlicher Code</dt>
            <dd className="font-mono text-2xl tracking-wider">{user.codeStem}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted">
          Stimmt etwas an deinem Code nicht? Wende dich an die Studienleitung, sie kann ihn korrigieren.
        </p>
      </Card>
    </div>
  );
}
