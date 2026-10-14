import { SCALE_MAX, SCALE_MIN, SMILEYS } from "@/lib/study/config";

// Echte Radio-Buttons, damit die Skalen ohne JavaScript, mit Tastatur und Screenreader funktionieren.
// Das Feld selbst ist unsichtbar, die Auswahl zeigt das umgebende Label über :has(:checked).
const optionClass =
  "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-border bg-surface " +
  "transition-colors hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-soft " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

function Legend({ text, required }: { text: string; required: boolean }) {
  return (
    <legend className="mb-3 font-medium">
      {text}
      {!required && <span className="font-normal text-muted"> (optional)</span>}
    </legend>
  );
}

export function SmileyScale({
  name,
  question,
  required,
  defaultValue,
}: {
  name: string;
  question: string;
  required: boolean;
  defaultValue?: number | null;
}) {
  return (
    <fieldset>
      <Legend text={question} required={required} />
      <div className="grid grid-cols-5 gap-2">
        {SMILEYS.map((smiley) => (
          <label key={smiley.value} className={`${optionClass} min-h-20 gap-1 px-1 py-2`}>
            <input
              type="radio"
              name={name}
              value={smiley.value}
              required={required}
              defaultChecked={defaultValue === smiley.value}
              className="sr-only"
            />
            <span aria-hidden className="text-3xl leading-none">
              {smiley.emoji}
            </span>
            <span className="text-center text-xs leading-tight text-muted">{smiley.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NumberScale({
  name,
  question,
  required,
  minLabel,
  maxLabel,
  defaultValue,
}: {
  name: string;
  question: string;
  required: boolean;
  minLabel: string;
  maxLabel: string;
  defaultValue?: number | null;
}) {
  const values = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);
  return (
    <fieldset>
      <Legend text={question} required={required} />
      <div className="grid grid-cols-11 gap-1">
        {values.map((value) => (
          <label key={value} className={`${optionClass} min-h-11 text-sm font-medium tabular-nums`}>
            <input
              type="radio"
              name={name}
              value={value}
              required={required}
              defaultChecked={defaultValue === value}
              aria-label={
                value === SCALE_MIN && minLabel
                  ? `${value} – ${minLabel}`
                  : value === SCALE_MAX && maxLabel
                    ? `${value} – ${maxLabel}`
                    : String(value)
              }
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div aria-hidden className="mt-1.5 flex justify-between gap-4 text-xs text-muted">
          {minLabel && (
            <span>
              {SCALE_MIN} = {minLabel}
            </span>
          )}
          {maxLabel && (
            <span className="ml-auto text-right">
              {SCALE_MAX} = {maxLabel}
            </span>
          )}
        </div>
      )}
    </fieldset>
  );
}
