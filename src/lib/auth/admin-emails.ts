/** Adressen aus ADMIN_EMAILS, kommagetrennt, Groß-/Kleinschreibung egal. */
export function parseAdminEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return parseAdminEmails(process.env.ADMIN_EMAILS).includes(email.toLowerCase());
}
