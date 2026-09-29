import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { CreateTeamForm, TeamRow } from "@/components/admin/team-forms";
import { Button, Card } from "@/components/ui";
import { setRole } from "@/lib/admin/actions";
import { listAdmins, listTeams } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Teams verwalten" };

export default async function TeamsPage() {
  const me = await requireAdmin();
  const [teams, admins] = await Promise.all([listTeams(), listAdmins()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Teams verwalten</h1>
        <p className="text-sm text-muted">
          Diese Teams stehen bei der Registrierung zur Auswahl. Einzelne Personen ordnest du auf
          ihrer jeweiligen Seite einem Team zu.
        </p>
      </div>

      <Card className="space-y-2">
        <CreateTeamForm />
        {teams.length > 0 && (
          <ul className="divide-y divide-border">
            {teams.map((team) => (
              // Schlüssel mit Namen, damit das Feld nach dem Umbenennen den neuen Stand zeigt
              <TeamRow key={`${team.id}-${team.name}`} team={team} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Admins</h2>
          <p className="text-sm text-muted">
            Admins sehen alle Einträge. Weitere Admins ernennst du auf der Seite der jeweiligen
            Person.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {admins.map((admin) => (
            <li key={admin.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="font-medium">
                {admin.displayName}
                {admin.id === me.id && <span className="font-normal text-muted"> (du)</span>}
              </span>
              {admin.id !== me.id && (
                <ConfirmForm
                  action={setRole.bind(null, admin.id, "user")}
                  message={`${admin.displayName} die Admin-Rechte entziehen?`}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Admin-Rechte entziehen
                  </Button>
                </ConfirmForm>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-sm">
        <Link href="/admin" className="text-muted hover:text-foreground">
          ← Zur Übersicht
        </Link>
      </p>
    </div>
  );
}
