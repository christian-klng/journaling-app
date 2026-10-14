import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/guards";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // Admins haben ihre eigene Ansicht und führen selbst kein Tagebuch
  if (user.role === "admin") redirect("/admin");

  return (
    <>
      <AppHeader displayName={user.displayName} home="/" groupMissing={!user.studyGroupId} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
