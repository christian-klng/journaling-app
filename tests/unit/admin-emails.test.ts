import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "@/lib/auth/admin-emails";

describe("parseAdminEmails", () => {
  it("trennt an Kommas und ignoriert Leerzeichen und Groß-/Kleinschreibung", () => {
    expect(parseAdminEmails(" Anna@Uni.de ,ben@uni.de,, ")).toEqual(["anna@uni.de", "ben@uni.de"]);
  });

  it("kommt mit fehlender Variable klar", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});
