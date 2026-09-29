"use client";

import { inputClass } from "@/components/ui";

/** Auswahlfeld, das sein Formular beim Ändern sofort absendet. */
export function AutoSubmitSelect({
  name,
  defaultValue,
  label,
  options,
}: {
  name: string;
  defaultValue: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={inputClass}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
