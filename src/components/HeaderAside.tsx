/**
 * Lets the request flow tell the header which step it is on.
 *
 * The request mocks draw the flow stepper inside the gray header bar, but the header belongs to the
 * router shell and knows nothing about the intake flow, so the flow has to publish upward.
 *
 * This carries a plain step string rather than a rendered node. An earlier version passed the
 * `<FlowStepper>` element itself through context and drove an effect off its element identity. That
 * worked, but a primitive dependency is easier to reason about and to assert on in a test, so it is
 * kept.
 *
 * Note the ordering this implies: the header's stepper updates one commit after the step content,
 * because the publish happens in an effect. That is a single frame and not perceptible, but a test
 * that reads the DOM immediately after the new step renders will see the previous stepper state.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FlowStep } from "../lib/intake/types";

interface FlowStepValue {
  step: FlowStep | null;
  setStep: (step: FlowStep | null) => void;
}

const FlowStepContext = createContext<FlowStepValue | null>(null);

export function HeaderAsideProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<FlowStep | null>(null);
  const value = useMemo(() => ({ step, setStep }), [step]);
  return <FlowStepContext.Provider value={value}>{children}</FlowStepContext.Provider>;
}

/** Read by the header to decide whether, and how, to draw the stepper. */
export function useHeaderFlowStep(): FlowStep | null {
  return useContext(FlowStepContext)?.step ?? null;
}

/**
 * Publishes the current step for as long as the calling view is mounted, then clears it, so
 * navigating away cannot leave a stale stepper in the header.
 */
export function usePublishFlowStep(step: FlowStep): void {
  const setStep = useContext(FlowStepContext)?.setStep;
  useEffect(() => {
    if (!setStep) return;
    setStep(step);
  }, [setStep, step]);

  useEffect(() => {
    if (!setStep) return;
    return () => setStep(null);
  }, [setStep]);
}
