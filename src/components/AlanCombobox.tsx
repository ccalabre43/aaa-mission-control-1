/**
 * ALAN number entry: an editable combobox seeded with the format template, offering previously
 * used numbers in a dropdown.
 *
 * Built on a native `<input>` plus a `<datalist>` rather than a custom listbox. A hand-rolled
 * combobox has to reimplement arrow-key navigation, typeahead, escape handling, and mobile
 * behavior, and usually gets some of it wrong; `<datalist>` gets all of that from the browser and
 * stays editable, which is the requirement. It looks like the control users already know
 * (Jakob's Law).
 *
 * Validation warns with "Wrong format" and never blocks. See src/lib/intake/alanNumber.ts.
 */
import { useId } from "react";
import { ALAN_TEMPLATE, validateAlan } from "../lib/intake/alanNumber";

interface AlanComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Previously used numbers, most recent first. */
  known: string[];
  /** Rendered as the field label. */
  label?: string;
}

export function AlanCombobox({
  value,
  onChange,
  known,
  label = "ALAN number",
}: AlanComboboxProps) {
  const inputId = useId();
  const listId = useId();
  const messageId = useId();
  const validation = validateAlan(value);
  const showWarning = Boolean(validation.warning);

  return (
    <div className="aaa-field-group">
      <label htmlFor={inputId} className="aaa-label">
        {label}
      </label>

      <input
        id={inputId}
        list={known.length > 0 ? listId : undefined}
        className="aaa-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        /* Placeholder shows the format only. The label above carries the name, because a
           placeholder disappears the moment someone types and cannot serve as a label. */
        placeholder={ALAN_TEMPLATE}
        autoComplete="off"
        spellCheck={false}
        /* Not aria-invalid: wrong format is a warning, not an error, and marking it invalid
           would tell assistive tech the field is blocking when it is not. */
        aria-describedby={showWarning ? messageId : undefined}
      />

      {known.length > 0 ? (
        <datalist id={listId}>
          {known.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}

      {/* Polite, so a warning does not interrupt while the user is still typing. */}
      <p id={messageId} className="aaa-field-warning" role="status" aria-live="polite">
        {validation.warning ?? ""}
      </p>
    </div>
  );
}
