/**
 * Step 3, per assets/mocks/creative-request-guided-questions-interface.png: one question at a time,
 * with a progress bar and "Question 1 of 9".
 *
 * One question per screen is the whole point of the flow - it is what replaces the email thread, and
 * it keeps each decision small (Hick's Law) while the progress bar supplies the Goal-Gradient
 * Effect.
 *
 * The count comes from the registry, so an admin adding a question changes "of 9" to "of 10"
 * automatically. Nothing here hard-codes nine.
 *
 * Related activity runs live alongside the questions and appears as soon as there is a match, so a
 * duplicate surfaces here rather than after all nine answers.
 */
import type { RefObject } from "react";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { RelatedWorkPanel } from "../../components/RelatedWorkPanel";
import { parseOptionValues } from "../../lib/intake/a3Schema";
import type { QuestionDef } from "../../lib/intake/questionRegistry";
import type { MatchOutcome } from "../../lib/related/types";

interface QuestionsStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  question: QuestionDef;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  matchOutcome: MatchOutcome | null;
  matching: boolean;
}

export default function QuestionsStep({
  headingRef,
  question,
  index,
  total,
  value,
  onChange,
  onBack,
  onNext,
  matchOutcome,
  matching,
}: QuestionsStepProps) {
  const answered = value.trim() !== "";
  // The flow diagram's only real decision point: required fields gate Next.
  const canAdvance = !question.required || answered;
  const percent = Math.round(((index + (answered ? 1 : 0)) / total) * 100);
  const hasMatches = (matchOutcome?.matches.length ?? 0) > 0;

  const isChoice =
    question.inputType === "radio" || question.inputType === "checkbox";
  /*
   * How many options a multi-select answer names. The gate above needs no special case: a joined
   * string is non-empty exactly when something is selected, and clearing the last box empties it.
   */
  const chosenCount =
    question.inputType === "checkbox"
      ? parseOptionValues(value, question.options).length
      : 0;

  return (
    <div className={hasMatches ? "aaa-flow-panel aaa-flow-with-aside" : "aaa-flow-panel"}>
      <div className="aaa-flow-main">
        <div className="aaa-step-header">
          <p className="aaa-step-label">
            Step 3 <span aria-hidden="true">&middot;</span> Guided questions
          </p>
          <p className="aaa-step-count">
            Question {index + 1} of {total}
          </p>
        </div>

        {/*
          A real progress element, so its value is exposed to assistive tech without ARIA
          bookkeeping. The blue fill on the track is 4.62:1, clearing 1.4.11.
        */}
        <progress
          className="aaa-progress"
          value={index + (answered ? 1 : 0)}
          max={total}
          aria-label={`Question ${index + 1} of ${total}`}
        >
          {percent}%
        </progress>

        <h1 className="aaa-flow-heading-left" tabIndex={-1} ref={headingRef}>
          {question.label}
        </h1>
        {question.helper ? (
          <p className="aaa-question-helper" id={`${question.id}-helper`}>
            {question.helper}
          </p>
        ) : null}

        <div className="aaa-field-group">
          {/* A choice group names itself through its legend, so an extra label would double it. */}
          {isChoice ? null : (
            <label className="sr-only" htmlFor={question.id}>
              {question.label}
            </label>
          )}

          {isChoice && question.options ? (
            <ChoiceGroup
              idPrefix={question.id}
              legend={question.label}
              options={question.options}
              value={value}
              multiple={question.inputType === "checkbox"}
              onChange={onChange}
              describedBy={question.helper ? `${question.id}-helper` : undefined}
            />
          ) : question.inputType === "date" ? (
            <input
              id={question.id}
              type="date"
              className="aaa-input aaa-input-date"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-describedby={question.helper ? `${question.id}-helper` : undefined}
            />
          ) : question.inputType === "text" ? (
            <input
              id={question.id}
              className="aaa-input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-describedby={question.helper ? `${question.id}-helper` : undefined}
            />
          ) : (
            <textarea
              id={question.id}
              className="aaa-textarea"
              rows={4}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-describedby={question.helper ? `${question.id}-helper` : undefined}
            />
          )}

          {/*
            Says what picking several actually does, in the requester's terms. They do not need to
            know that Workfront's field takes one value - that is the producer's problem and it is
            recorded in the Issue description instead. role=status because this appears in response
            to a click and would otherwise be silent to a screen reader.
          */}
          {chosenCount > 1 ? (
            <p className="aaa-field-hint" role="status">
              Both teams will be named on this request.
            </p>
          ) : null}
        </div>

        <div className="aaa-flow-actions">
          <button type="button" className="aaa-btn-text" onClick={onBack}>
            Back
          </button>
          <div className="aaa-next-group">
            {/*
              Disabled Next needs an explanation, or it reads as a broken button. The reason is
              text, not styling, and it is present before the user tries to click.
            */}
            {!canAdvance ? (
              <p className="aaa-next-hint" id={`${question.id}-gate`}>
                Answer this to continue.
              </p>
            ) : null}
            <button
              type="button"
              className="aaa-btn aaa-btn-primary"
              onClick={onNext}
              disabled={!canAdvance}
              aria-describedby={!canAdvance ? `${question.id}-gate` : undefined}
            >
              {index + 1 === total ? "Review related activity" : "Next"}
            </button>
          </div>
        </div>
      </div>

      {/*
        Only rendered once something matched. An empty panel beside every question would be noise,
        and the full coverage disclosure gets its own dedicated step next.
      */}
      {hasMatches ? (
        <aside className="aaa-flow-aside">
          <RelatedWorkPanel outcome={matchOutcome} busy={matching} compact />
        </aside>
      ) : null}
    </div>
  );
}
