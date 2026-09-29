"use client";

import type { ReactNode } from "react";

/** Formular, das vor dem Absenden nachfragt. Für Aktionen mit größerer Tragweite. */
export function ConfirmForm({
  action,
  message,
  children,
}: {
  action: () => Promise<void>;
  message: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
