import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { CreateAdmin } from "@/components/admin/create-admin";
import { Button, Card } from "@/components/ui";
import { deleteAdmin } from "@/lib/admin/actions";
import { listAdmins } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Admins" };

export default async function AdminsPage() {
  const me = await requireAdmin();
  const admins = await listAdmins();

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Admins</h1>
            <p className="text-sm text-muted">
              Admins sehen alle Einträge. Ihre Konten sind getrennt von denen der Teilnehmenden.
            </p>
          </div>
          <CreateAdmin />
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
                  action={deleteAdmin.bind(null, admin.id)}
                  message={`Das Admin-Konto ${admin.displayName} löschen?`}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Konto löschen
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
