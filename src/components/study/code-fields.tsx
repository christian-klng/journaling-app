import { Field, inputClass } from "@/components/ui";
import { MONTHS } from "@/lib/study/code";

/** Erklärung und Eingabe der drei Teile des persönlichen Codes. Der Gruppenbuchstabe kommt später dazu. */
export function CodeFields({
  defaults,
  randomGroup = false,
}: {
  defaults?: { mother?: string; month?: string; birthplace?: string };
  randomGroup?: boolean;
}) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-border p-4">
      <legend className="px-1 font-semibold">Persönlicher Code</legend>
      <p className="text-sm text-muted">
        Damit deine Einträge mit möglichen späteren Befragungen verknüpft werden können, ohne deinen
        Namen zu erfassen, bildest du einen persönlichen Code. Nur du kannst ihn erneut erzeugen. Der
        letzte Teil ist der Buchstabe deiner Gruppe,{" "}
        {randomGroup ? "die dir die App bei der Registrierung zuteilt" : "den dir die Studienleitung mitteilt"}.
        Beispiel: KA-03-BE-A
      </p>
      <Field label="Die ersten beiden Buchstaben des Vornamens deiner Mutter">
        <input
          name="mother"
          required
          minLength={2}
          maxLength={2}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={defaults?.mother}
          placeholder="z. B. KA"
          className={`${inputClass} uppercase`}
        />
      </Field>
      <Field label="Dein Geburtsmonat">
        <select name="month" required defaultValue={defaults?.month ?? ""} className={inputClass}>
          <option value="" disabled>
            Bitte wählen
          </option>
          {MONTHS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.value} – {month.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Die ersten beiden Buchstaben deines Geburtsortes">
        <input
          name="birthplace"
          required
          minLength={2}
          maxLength={2}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={defaults?.birthplace}
          placeholder="z. B. BE"
          className={`${inputClass} uppercase`}
        />
      </Field>
    </fieldset>
  );
}
