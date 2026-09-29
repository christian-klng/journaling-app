import { cloneElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong dark:text-background",
  secondary: "border border-border bg-surface hover:bg-accent-soft",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
  ghost: "text-muted hover:bg-accent-soft hover:text-foreground",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "sm" = "md") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "min-h-11 px-4 text-base" : "min-h-9 px-3 text-sm",
    BUTTON_VARIANTS[variant],
  ].join(" ");
}

export function Button({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "md" | "sm" }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export const inputClass =
  "block min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground " +
  "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? cloneElement(children, { "aria-describedby": hintId }) : children}
      </label>
      {/* Außerhalb des Labels, damit der Hinweis nicht Teil des Feldnamens wird */}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`} {...props} />
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">{children}</p>;
}
