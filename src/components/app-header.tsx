import Link from "next/link";
import { UserMenu } from "./user-menu";

export function AppHeader({
  displayName,
  home,
  nav = [],
  groupMissing = false,
}: {
  displayName: string;
  /** Teilnehmende ohne Gruppe sehen am Menü einen roten Punkt */
  groupMissing?: boolean;
  home: "/" | "/admin";
  nav?: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      {/* Auf dem Handy steht die Navigation in einer eigenen Zeile unter Name und Menü */}
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href={home} className="text-lg font-semibold tracking-tight">
          Journaling
        </Link>
        {nav.length > 0 && (
          <nav className="order-last flex w-full gap-4 overflow-x-auto text-sm whitespace-nowrap sm:order-none sm:w-auto sm:flex-1">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="py-2 text-muted hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto sm:ml-0">
          <UserMenu displayName={displayName} profile={home === "/"} groupMissing={groupMissing} />
        </div>
      </div>
    </header>
  );
}
