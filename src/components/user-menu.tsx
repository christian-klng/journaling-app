"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";

export function UserMenu({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menü für ${displayName}`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          {displayName[0]}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{displayName}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="border-b border-border px-3 pb-2 pt-1 text-sm">
            <span className="block text-muted">Angemeldet als</span>
            <span className="font-medium">{displayName}</span>
          </p>
          <Link
            role="menuitem"
            href="/passwort-aendern"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm hover:bg-accent-soft"
          >
            Passwort ändern
          </Link>
          <form action={logout}>
            <button
              role="menuitem"
              type="submit"
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent-soft"
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
