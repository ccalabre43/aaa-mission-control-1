/**
 * A group of fixed choices from an A3 field's own option list, as either one choice or several.
 *
 * Shared because the same control appears in three places - the guided question, and both the edit
 * and missing-required paths of the review step. Duplicating the toggle arithmetic three times is
 * how one copy ends up writing a value the other two cannot read back.
 *
 * The value is always the canonical joined string produced by `formatOptionValues`, so a single
 * choice and several choices are the same shape in storage and neither needs a migration.
 *
 * A `fieldset` with a `legend` rather than loose inputs: without it, a screen reader announces
 * "Corporate Communications, checkbox" with no indication of what question it belongs to. The
 * legend is visually hidden because every caller already renders the same text as a heading or a
 * term, and showing it twice is its own kind of noise.
 */
import {
  parseOptionValues,
  toggleOptionValue,
} from "../lib/intake/a3Schema";

interface ChoiceGroupProps {
  /** Unique per instance. Becomes the radio group name and each input's id. */
  idPrefix: string;
  /** Announced with each option. Visually hidden. */
  legend: string;
  options: readonly string[];
  /** Canonical joined string. A single option for single-choice groups. */
  value: string;
  /** True for checkboxes, false for radios. */
  multiple: boolean;
  onChange: (value: string) => void;
  /** Id of helper text, so the group carries it too. */
  describedBy?: string;
}

export function ChoiceGroup({
  idPrefix,
  legend,
  options,
  value,
  multiple,
  onChange,
  describedBy,
}: ChoiceGroupProps) {
  const selected = multiple
    ? parseOptionValues(value, options)
    : parseOptionValues(value, options).slice(0, 1);

  return (
    <fieldset className="aaa-fieldset" aria-describedby={describedBy}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const inputId = `${idPrefix}-${option.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <label
            key={option}
            htmlFor={inputId}
            className={multiple ? "aaa-checkbox-row" : "aaa-radio-row"}
          >
            <input
              id={inputId}
              type={multiple ? "checkbox" : "radio"}
              name={idPrefix}
              value={option}
              checked={selected.includes(option)}
              onChange={() =>
                onChange(
                  multiple
                    ? toggleOptionValue(value, option, options)
                    : option,
                )
              }
              className={multiple ? "aaa-checkbox" : "aaa-radio"}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
