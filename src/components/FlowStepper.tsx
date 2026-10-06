/**
 * The four-stage stepper drawn in the request mocks' header: Context, Guided questions, AI draft,
 * and a final stage the mocks call "Submitted" and this ships as "Ready to send".
 *
 * Four stages for seven states is deliberate and matches the mocks. Related activity, Generating,
 * and Review draft all sit under "AI draft", because a requester does not benefit from watching a
 * seven-item progress indicator (Miller's Law), and the Goal-Gradient Effect works better with
 * fewer, larger increments.
 *
 * Accessibility notes:
 * - Rendered as an ordered list, since the stages are sequential.
 * - The current stage carries `aria-current="step"`.
 * - Stage state is never conveyed by color alone: each dot's status is also in visually hidden
 *   text, so "done", "current", and "upcoming" survive both color blindness and a screen reader
 *   (1.4.1 Use of Color).
 * - The dots use the darker green `#0D5C2E`, not the bright brand-exception green. A small dot in
 *   `#16A34A` is 2.84:1 against the gray header and fails 1.4.11; the darker green is 7.00:1.
 */
import type { FlowStep } from "../lib/intake/types";

/*
 * The fourth stage's label is "Ready to send", not the mocks' "Submitted". Nothing is transmitted to
 * Workfront, and the Request Queue and match cards both use "Ready to send" via `briefStatusLabel`;
 * leaving this as "Submitted" made the header contradict the queue for the same request. The stage
 * `id` stays `submitted` because `stageIndexFor` keys off `FlowStep`, not off these labels.
 */
const STAGES = [
  { id: "context", label: "Context" },
  { id: "questions", label: "Guided questions" },
  { id: "draft", label: "AI draft" },
  { id: "submitted", label: "Ready to send" },
] as const;

/** The start screen shows no stepper, matching the mock, so it maps to -1. */
export function stageIndexFor(step: FlowStep): number {
  switch (step) {
    case "start":
      return -1;
    case "context":
      return 0;
    case "questions":
      return 1;
    case "related":
    case "generating":
    case "draft":
      return 2;
    case "confirmed":
      return 3;
    default:
      return -1;
  }
}

export function FlowStepper({ step }: { step: FlowStep }) {
  const active = stageIndexFor(step);
  if (active < 0) return null;

  return (
    <nav aria-label="Request progress" className="aaa-stepper">
      <ol role="list">
        {STAGES.map((stage, index) => {
          const state =
            index < active ? "done" : index === active ? "current" : "upcoming";
          return (
            <li key={stage.id} className={`aaa-stepper-item aaa-stepper-${state}`}>
              {index > 0 ? (
                <span className="aaa-stepper-rule" aria-hidden="true" />
              ) : null}
              <span
                className="aaa-stepper-dot"
                aria-hidden="true"
                data-state={state}
              />
              <span
                className="aaa-stepper-label"
                aria-current={state === "current" ? "step" : undefined}
              >
                {stage.label}
                <span className="sr-only">
                  {state === "done"
                    ? " (completed)"
                    : state === "current"
                      ? " (current step)"
                      : " (not started)"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
