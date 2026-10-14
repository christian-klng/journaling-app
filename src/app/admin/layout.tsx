import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <>
      <AppHeader
        displayName={admin.displayName}
        home="/admin"
        nav={[
          { href: "/admin", label: "Übersicht" },
          { href: "/admin/studie", label: "Studie" },
          { href: "/admin/teilnahme", label: "Teilnahme" },
          { href: "/admin/einstellungen", label: "Einstellungen" },
          { href: "/admin/admins", label: "Admins" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
