import { buttonClass } from "@/components/ui";

export function ExportLink({
  query = "",
  label,
  size = "sm",
}: {
  query?: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    // Normaler Link statt next/link, damit der Browser die Datei herunterlädt
    <a href={`/api/admin/export${query}`} download className={buttonClass("secondary", size)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="size-4"
      >
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      {label}
    </a>
  );
}
