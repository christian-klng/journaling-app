import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Impressum" };

export default function ImprintPage() {
  const { controller, studyLead, operator } = LEGAL;

  return (
    <>
      <h1 className="text-2xl font-semibold">Impressum</h1>

      <section>
        <p>
          Diese App dient ausschließlich einer Studie{LEGAL.project && ` „${LEGAL.project}“`} der{" "}
          {controller.name}. Sie ist nicht öffentlich und nicht kommerziell.
        </p>
      </section>

      <section>
        <h2>Anbieterin</h2>
        <p>
          {controller.name}
          <br />
          {controller.representedBy}
          <br />
          {controller.address.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
          <a href={`mailto:${controller.email}`}>{controller.email}</a>
        </p>
        <p>
          Weitere Angaben im <a href={controller.imprint}>Impressum der HWR Berlin</a>.
        </p>
      </section>

      <section>
        <h2>Inhaltlich verantwortlich für die Studie</h2>
        <p>
          {studyLead.name}, {studyLead.role}
          <br />
          <a href={`mailto:${studyLead.email}`}>{studyLead.email}</a>
        </p>
      </section>

      <section>
        <h2>Entwicklung und technischer Betrieb</h2>
        <p>
          {operator.name}, {operator.address.join(", ")}. Sie hat die App entwickelt und betreibt sie
          im Auftrag der HWR Berlin.
        </p>
      </section>

      <p>
        <Link href="/datenschutz">Zur Datenschutzinformation</Link>
      </p>
    </>
  );
}
