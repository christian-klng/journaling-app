import Link from "next/link";
import { UserMenu } from "./user-menu";

export function AppHeader({
  displayName,
  email,
  home,
  nav = [],
}: {
  displayName: string;
  /** Nur die eigene Adresse der angemeldeten Person, nie die einer anderen */
  email: string;
  home: "/" | "/admin";
  nav?: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href={home} className="text-lg font-semibold tracking-tight">
          Journaling
        </Link>
        <nav className="flex min-w-0 flex-1 gap-4 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <UserMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}
