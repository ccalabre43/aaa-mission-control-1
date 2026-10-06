/**
 * Step 6, Review draft, with the inline edit toggle the flow diagram calls for.
 *
 * This is the last human-in-the-loop checkpoint, and the requester's words are what get submitted,
 * so editing has to be genuinely available rather than a formality. The assembled draft is shown
 * read-only by default and each section flips to a textarea in place.
 *
 * Required fields are marked and missing ones are named up front, because discovering a blocker
 * after pressing Submit is the worst place to learn about it.
 */
import { useMemo, useState, type RefObject } from "react";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import {
  A3_SUBMITTED_FIELDS,
  groupA3BySection,
  isOptionField,
  parseOptionValues,
  validateA3,
  type A3FieldName,
} from "../../lib/intake/a3Schema";
import type { QuestionRegistry } from "../../lib/intake/questionRegistry";
import type { IntakeBrief } from "../../lib/intake/types";
import type { QueueDef } from "../../lib/workfront/queueConfig";
import { pathLabel, routeExplanation, routeFor } from "../../lib/workfront/routing";

interface ReviewStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  brief: IntakeBrief;
  /** Needed to know whether a choice field was asked as one answer or several. */
  registry: QuestionRegistry;
  /** Needed to show where the request will route. Never edited from here. */
  queueConfig: QueueDef;
  onBack: () => void;
  onSubmit: (brief: IntakeBrief) => void;
}

export default function ReviewStep({
  headingRef,
  brief,
  registry,
  queueConfig,
  onBack,
  onSubmit,
}: ReviewStepProps) {
  const [values, setValues] = useState(brief.a3);
  const [editing, setEditing] = useState<A3FieldName | null>(null);

  const validation = useMemo(() => validateA3(values), [values]);
  const grouped = useMemo(() => groupA3BySection(values), [values]);

  /*
   * Recomputed from the live edits, not from `brief`. Editing the team answer on this screen changes
   * where the request goes, and a Path that stayed stale while the answer above it changed would be
   * worse than showing none - the requester would have read a route that was never going to happen.
   */
  const route = useMemo(
    () => routeFor(queueConfig, { ...brief, a3: values }),
    [queueConfig, brief, values],
  );

  /**
   * Which choice fields edit as several answers rather than one.
   *
   * Taken from the registry, so review offers exactly what the requester was asked. When no
   * question targets the field - it was disabled, or the draft predates it - fall back to what the
   * value already holds, because rendering a single-choice control over a two-value answer is how
   * the answer silently becomes one value the moment anyone touches it.
   *
   * Deliberately keyed on the brief's assembled values rather than live edits: deriving it from
   * `values` would flip the control from checkboxes to radios the instant someone unchecked down to
   * one, swapping the widget under their cursor.
   */
  const multiFields = useMemo(() => {
    const names = new Set<A3FieldName>();
    for (const field of A3_SUBMITTED_FIELDS) {
      if (!isOptionField(field.name)) continue;
      const question = registry.questions.find(
        (item) => item.target === field.name,
      );
      const multi = question
        ? question.inputType === "checkbox"
        : parseOptionValues(brief.a3[field.name], field.options).length > 1;
      if (multi) names.add(field.name);
    }
    return names;
  }, [registry, brief.a3]);

  /** Required fields with no value are shown even though groupA3BySection drops empties. */
  const emptyRequired = validation.missing;

  function update(name: A3FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="aaa-flow-panel">
      <p className="aaa-step-label">
        Step 5 <span aria-hidden="true">&middot;</span> Review your brief
      </p>

      <h1 className="aaa-flow-heading-left" tabIndex={-1} ref={headingRef}>
        Here is your brief. Change anything that is not right.
      </h1>
      <p className="aaa-flow-sub-left">
        This is what the creative team receives. Select Edit on any section to change it.
      </p>

      {emptyRequired.length > 0 ? (
        <div role="alert" className="aaa-flow-alert">
          Still needed before this can be submitted:{" "}
          {emptyRequired.map((field) => field.label).join(", ")}.
        </div>
      ) : null}

      {/*
        Read-only, and above the fields rather than below them. Where the work lands is the one thing
        on this screen the requester cannot change by editing a field, so it is stated as a
        consequence of their answers, with the reason attached per the auditable-recommendation rule.
      */}
      <div className="aaa-route-callout">
        <p className="aaa-route-label">Where this goes</p>
        <p className="aaa-route-path">{pathLabel(route)}</p>
        <p className="aaa-route-reason">{routeExplanation(route)}</p>
      </div>

      <dl className="aaa-review">
        {grouped.map((group) => (
          <div key={group.section} className="aaa-review-section">
            <h2 className="aaa-review-section-heading">{group.section}</h2>
            {group.fields.map((field) => (
              <div key={field.name} className="aaa-review-row">
                <dt className="aaa-review-label">
                  {field.label}
                  {field.required ? (
                    <span className="aaa-required" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  ) : null}
                  {field.required ? <span className="sr-only"> (required)</span> : null}
                </dt>
                <dd className="aaa-review-value">
                  {editing === field.name ? (
                    <>
                      {/* A choice group is named by its own legend. */}
                      {isOptionField(field.name) ? null : (
                        <label className="sr-only" htmlFor={`edit-${field.name}`}>
                          {field.label}
                        </label>
                      )}
                      {field.type === "date" ? (
                        <input
                          id={`edit-${field.name}`}
                          type="date"
                          className="aaa-input aaa-input-date"
                          value={values[field.name] ?? ""}
                          onChange={(event) => update(field.name, event.target.value)}
                        />
                      ) : isOptionField(field.name) && field.options ? (
                        <ChoiceGroup
                          idPrefix={`edit-${field.name}`}
                          legend={field.label}
                          options={field.options}
                          value={values[field.name] ?? ""}
                          multiple={multiFields.has(field.name)}
                          onChange={(next) => update(field.name, next)}
                        />
                      ) : (
                        <textarea
                          id={`edit-${field.name}`}
                          className="aaa-textarea"
                          rows={4}
                          value={values[field.name] ?? ""}
                          onChange={(event) => update(field.name, event.target.value)}
                        />
                      )}
                      <button
                        type="button"
                        className="aaa-btn-text"
                        onClick={() => setEditing(null)}
                      >
                        Done
                        <span className="sr-only"> editing {field.label}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="aaa-review-text">{values[field.name]}</p>
                      <button
                        type="button"
                        className="aaa-btn-text"
                        onClick={() => setEditing(field.name)}
                      >
                        Edit
                        <span className="sr-only"> {field.label}</span>
                      </button>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </div>
        ))}

        {/* Empty required fields are editable here rather than sending the user back a step. */}
        {emptyRequired.map((field) => (
          <div key={field.name} className="aaa-review-row aaa-review-row-missing">
            <dt className="aaa-review-label">
              {field.label}
              <span className="aaa-required" aria-hidden="true">
                {" "}
                *
              </span>
              <span className="sr-only"> (required)</span>
            </dt>
            <dd className="aaa-review-value">
              {isOptionField(field.name) ? null : (
                <label className="sr-only" htmlFor={`missing-${field.name}`}>
                  {field.label}
                </label>
              )}
              {field.type === "date" ? (
                <input
                  id={`missing-${field.name}`}
                  type="date"
                  className="aaa-input aaa-input-date"
                  value={values[field.name] ?? ""}
                  onChange={(event) => update(field.name, event.target.value)}
                />
              ) : isOptionField(field.name) && field.options ? (
                <ChoiceGroup
                  idPrefix={`missing-${field.name}`}
                  legend={field.label}
                  options={field.options}
                  value={values[field.name] ?? ""}
                  multiple={multiFields.has(field.name)}
                  onChange={(next) => update(field.name, next)}
                />
              ) : (
                <textarea
                  id={`missing-${field.name}`}
                  className="aaa-textarea"
                  rows={3}
                  value={values[field.name] ?? ""}
                  onChange={(event) => update(field.name, event.target.value)}
                />
              )}
            </dd>
          </div>
        ))}
      </dl>

      {brief.attachments.length > 0 ? (
        <p className="aaa-field-hint">
          Attached:{" "}
          {brief.attachments.map((attachment) => attachment.fileName).join(", ")}
        </p>
      ) : null}

      <div className="aaa-flow-actions">
        {/* Skips Generating, per the flow diagram: regenerating would discard these edits. */}
        <button type="button" className="aaa-btn-text" onClick={onBack}>
          Back to related activity
        </button>
        <button
          type="button"
          /* Red is reserved for the final submit and genuine errors. This is that submit. */
          className="aaa-btn aaa-btn-submit"
          onClick={() => onSubmit({ ...brief, a3: values })}
          disabled={!validation.valid}
          aria-describedby={!validation.valid ? "submit-gate" : undefined}
        >
          Submit request
        </button>
      </div>
      {!validation.valid ? (
        <p id="submit-gate" className="aaa-next-hint">
          Fill in the required fields above to submit.
        </p>
      ) : null}

      <p className="aaa-flow-footnote">
        {A3_SUBMITTED_FIELDS.length} fields map to the Workfront intake form. Submitting saves
        this to your device; it is not sent to Workfront yet.
      </p>
    </div>
  );
}
