/**
 * Step 5, Generating.
 *
 * The flow diagram marks this as where an LLM call would go. It currently does not: assembly is
 * deterministic and effectively instant.
 *
 * That creates a real design question - a progress screen with nothing to wait for. Two choices were
 * rejected: a fake delay, which wastes the requester's time to look busy, and skipping the screen,
 * which would remove the step the flow diagram specifies and make the later swap to a real LLM call
 * a structural change rather than a substitution.
 *
 * So the screen renders, reports the steps it genuinely performs, and advances as soon as they are
 * done. It also names what produced the draft, because "AI drafted this" would be untrue today.
 */
import { useEffect, useState, type RefObject } from "react";

interface GeneratingStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  assistantLabel: string;
  onDone: () => void;
}

export default function GeneratingStep({
  headingRef,
  assistantLabel,
  onDone,
}: GeneratingStepProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A frame's delay so the heading can take focus and be announced before the view swaps out.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      Promise.resolve(onDone()).catch(() => {
        if (!cancelled) setFailed(true);
      });
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <div className="aaa-flow-centered">
      <h1 className="aaa-flow-heading" tabIndex={-1} ref={headingRef}>
        Putting your brief together
      </h1>

      {failed ? (
        <p className="aaa-field-error" role="alert">
          The brief could not be assembled. Go back a step and try again - your answers are
          saved.
        </p>
      ) : (
        <>
          {/*
            2.2.2 Pause, Stop, Hide: the spinner is decorative and CSS-driven, and it respects
            prefers-reduced-motion in index.css rather than animating regardless.
          */}
          <span className="aaa-spinner" aria-hidden="true" />
          <p className="aaa-flow-sub" role="status" aria-live="polite">
            Organizing your answers into the creative brief format.
          </p>
          <p className="aaa-flow-footnote">
            {assistantLabel}. Every line comes from something you typed - nothing is invented.
          </p>
        </>
      )}
    </div>
  );
}
