/**
 * The creative request flow: Start, Context, Guided questions, Related activity, Generating,
 * Review draft, Confirmed.
 *
 * Structure follows assets/mocks/requestor-ux-flow.jpg exactly, including its two back edges:
 * Related activity goes back to the LAST guided question rather than the first, and Review draft
 * goes back to Related activity, skipping Generating. Regenerating a draft the requester has
 * already edited would silently discard their edits, which is why that edge skips it.
 *
 * The only real decision point in the flow is the per-question required-field gate. Everything else
 * is linear.
 *
 * Related-work matching runs live in the background while questions are answered, so a duplicate
 * surfaces at question two instead of after nine answers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePublishFlowStep } from "../../components/HeaderAside";
import { defaultAssistant } from "../../lib/intake/assistant";
import {
  mergeComplianceFlags,
  scanForComplianceFlags,
} from "../../lib/intake/complianceHeuristics";
import {
  activeQuestions,
  loadRegistry,
  type QuestionDef,
} from "../../lib/intake/questionRegistry";
import {
  loadBriefs,
  loadIdentity,
  loadRecentAlan,
  saveIdentity,
  saveRecentAlan,
  upsertBrief,
} from "../../lib/intake/storage";
import {
  createBrief,
  type AttachmentRef,
  type FlowStep,
  type IntakeBrief,
  type RequesterIdentity,
} from "../../lib/intake/types";
import { collectKnownAlanNumbers, normalizeAlan } from "../../lib/intake/alanNumber";
import { defaultAlanDetector } from "../../lib/intake/alanDetector";
import { buildCorpus } from "../../lib/related/corpus";
import { defaultMatcher } from "../../lib/related/LocalMatcher";
import type {
  MatchOutcome,
  MatchResolution,
  ResolvedMatch,
} from "../../lib/related/types";
import { loadRows } from "../../lib/storage";
import { submitToWorkfront } from "../../lib/workfront/submitToWorkfront";
import { loadQueueConfig } from "../../lib/workfront/queueConfig";
import { queueTopicIdFor } from "../../lib/workfront/routing";
import StartStep from "./StartStep";
import ContextStep from "./ContextStep";
import QuestionsStep from "./QuestionsStep";
import RelatedStep from "./RelatedStep";
import GeneratingStep from "./GeneratingStep";
import ReviewStep from "./ReviewStep";
import ConfirmedStep from "./ConfirmedStep";

/** Debounce for live matching. Comfortably under the Doherty Threshold once it fires. */
const MATCH_DEBOUNCE_MS = 400;

export default function RequestFlowView() {
  const navigate = useNavigate();
  const [registry] = useState(() => loadRegistry());
  const questions = useMemo(() => activeQuestions(registry), [registry]);

  /*
   * Read once at mount, like the question registry above and for the same reason: an admin editing
   * topics in another tab must not change where a half-finished request routes. The request is
   * assembled against the configuration in force when it started.
   */
  const [queueConfig] = useState(() => loadQueueConfig().config);

  const [brief, setBrief] = useState<IntakeBrief>(() =>
    createBrief({
      identity: loadIdentity(),
      questionSetVersion: registry.version,
    }),
  );
  const [step, setStep] = useState<FlowStep>("start");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  /** Real File objects, kept in memory only. Contents are never persisted. */
  const [files, setFiles] = useState<File[]>([]);
  const [alanInput, setAlanInput] = useState("");
  const [alanPrompted, setAlanPrompted] = useState(false);
  const [detectionNote, setDetectionNote] = useState<string | null>(null);

  const [matchOutcome, setMatchOutcome] = useState<MatchOutcome | null>(null);
  const [matching, setMatching] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, MatchResolution>>({});
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  usePublishFlowStep(step);

  const knownAlanNumbers = useMemo(() => {
    const { briefs } = loadBriefs();
    return collectKnownAlanNumbers(briefs, loadRecentAlan());
  }, []);

  // Pre-populate with the most recently used number, per the requirement. Done once, and only
  // when the field is untouched, so it cannot overwrite typing.
  useEffect(() => {
    const recent = knownAlanNumbers[0];
    if (recent) setAlanInput(recent);
  }, [knownAlanNumbers]);

  /**
   * Moving focus to the step heading on every transition. Without this, a keyboard or screen reader
   * user stays focused on the Next button they just pressed and never learns the screen changed -
   * the most common single-page-app accessibility failure.
   *
   * Deliberately skipped on arrival. Focusing the heading on load would drag focus into the middle of
   * the document, putting the skip link and the header behind the user so that forward Tab can never
   * reach them. Verified: doing this moved the first tab stop from the skip link to the department
   * select.
   *
   * Keyed on the step actually changing, rather than on a "first render" boolean. The boolean version
   * was defeated by StrictMode, which re-runs an effect on the *same* component instance - so the ref
   * it set on the first pass was already spent, and the second pass focused the heading on load. The
   * skip link was unreachable by Tab on this screen as a result. Comparing against the last focused
   * step is immune to that, because a repeated invocation carries the same step and does nothing.
   */
  const lastFocusedStep = useRef<string | null>(null);
  useEffect(() => {
    const current = `${step}:${questionIndex}`;
    if (lastFocusedStep.current === null) {
      // Arrival. Record where we are without moving focus.
      lastFocusedStep.current = current;
      return;
    }
    if (lastFocusedStep.current === current) return;
    lastFocusedStep.current = current;
    headingRef.current?.focus();
  }, [step, questionIndex]);

  const conceptText = useMemo(() => {
    return [brief.contextText, ...Object.values(answers)].filter(Boolean).join(" ");
  }, [brief.contextText, answers]);

  const deadline = useMemo(() => {
    const dateQuestion = questions.find(
      (question) => question.target === "A3IntakeDesiredCompletionDate",
    );
    return dateQuestion ? answers[dateQuestion.id]?.trim() || null : null;
  }, [questions, answers]);

  const runMatch = useCallback(async () => {
    const trimmed = conceptText.trim();
    if (trimmed.length < 12) {
      setMatchOutcome(null);
      return;
    }
    setMatching(true);
    try {
      const { briefs } = loadBriefs();
      const trackerRows = loadRows().rows;
      const corpus = buildCorpus(briefs, trackerRows, brief.id);
      const outcome = await defaultMatcher.match(
        {
          alanNumber: brief.alanNumber,
          team: brief.identity.department,
          conceptText: trimmed,
          title: trimmed.slice(0, 120),
          deadline,
          deliverables: [],
          dismissedIds,
          excludeId: brief.id,
        },
        corpus,
      );
      setMatchOutcome(outcome);
    } finally {
      setMatching(false);
    }
  }, [
    conceptText,
    brief.alanNumber,
    brief.id,
    brief.identity.department,
    deadline,
    dismissedIds,
  ]);

  // Live matching, debounced so it does not run on every keystroke.
  useEffect(() => {
    if (step !== "questions" && step !== "context" && step !== "related") return;
    const timer = window.setTimeout(runMatch, MATCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [runMatch, step]);

  /** Persists a patch and keeps the in-memory brief authoritative. */
  const patchBrief = useCallback((patch: Partial<IntakeBrief>) => {
    setBrief((current) => {
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      const result = upsertBrief(next);
      if (!result.ok && result.reason) setError(result.reason);
      return next;
    });
  }, []);

  function handleStart(identity: RequesterIdentity) {
    saveIdentity(identity);
    patchBrief({ identity });
    setStep("context");
  }

  async function handleContextNext(contextText: string) {
    const flags = mergeComplianceFlags(
      brief.complianceFlags,
      scanForComplianceFlags({ contextText, answers }),
    );
    const alan = normalizeAlan(alanInput);
    patchBrief({
      contextText,
      complianceFlags: flags,
      alanNumber: alan || null,
      alanAnswered: alanPrompted || Boolean(alan),
    });
    if (alan) saveRecentAlan(alan);
    setStep("questions");
    setQuestionIndex(0);
  }

  /**
   * Adds attachments and runs ALAN detection.
   *
   * `NoopDetector` always reports nothing found, so the "Do you have an ALAN number?" branch always
   * runs. That is the designed no-match path, exercised for real rather than stubbed around.
   */
  async function handleFiles(incoming: File[]) {
    const refs: AttachmentRef[] = incoming.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      addedAt: new Date().toISOString(),
    }));
    const nextFiles = [...files, ...incoming];
    const nextRefs = [...brief.attachments, ...refs];
    setFiles(nextFiles);
    patchBrief({ attachments: nextRefs });

    const detection = await defaultAlanDetector.detect(nextFiles, nextRefs);
    if (detection.candidates.length > 0) {
      const found = detection.candidates[0];
      setAlanInput(found.value);
      setAlanPrompted(true);
      setDetectionNote(
        `Found ${found.value} in ${found.sourceFileName}. Change it below if that is not right.`,
      );
      setAnnouncement(`ALAN number ${found.value} found in ${found.sourceFileName}.`);
    } else {
      setAlanPrompted(true);
      setDetectionNote(detection.note ?? null);
    }
  }

  function removeAttachment(id: string) {
    const ref = brief.attachments.find((attachment) => attachment.id === id);
    patchBrief({
      attachments: brief.attachments.filter((attachment) => attachment.id !== id),
    });
    if (ref) setFiles((current) => current.filter((file) => file.name !== ref.fileName));
  }

  function answerFor(question: QuestionDef): string {
    return answers[question.id] ?? "";
  }

  function setAnswer(question: QuestionDef, value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  function handleQuestionNext() {
    const question = questions[questionIndex];
    if (!question) return;
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    const flags = mergeComplianceFlags(
      brief.complianceFlags,
      scanForComplianceFlags({ contextText: brief.contextText, answers }),
    );
    patchBrief({
      complianceFlags: flags,
      questionIdsAsked: questions.map((item) => item.id),
      answers,
    });
    setStep("related");
  }

  function handleQuestionBack() {
    if (questionIndex === 0) {
      setStep("context");
      return;
    }
    setQuestionIndex(questionIndex - 1);
  }

  function handleResolve(recordId: string, resolution: MatchResolution) {
    setResolutions((current) => ({ ...current, [recordId]: resolution }));
    if (resolution === "not-a-match") {
      setDismissedIds((current) =>
        current.includes(recordId) ? current : [...current, recordId],
      );
    }
  }

  function collectResolvedMatches(): ResolvedMatch[] {
    if (!matchOutcome) return [];
    return Object.entries(resolutions).flatMap(([recordId, resolution]) => {
      const match = matchOutcome.matches.find((item) => item.record.id === recordId);
      if (!match) return [];
      return [
        {
          recordId,
          resolution,
          classification: match.classification,
          alanNumber: match.record.alanNumber,
          title: match.record.title,
          resolvedAt: new Date().toISOString(),
        },
      ];
    });
  }

  function handleRelatedNext() {
    patchBrief({
      resolvedMatches: collectResolvedMatches(),
      // Captured here so the brief records what the duplicate check actually covered.
      matchCoverage: matchOutcome?.coverage ?? null,
    });
    setStep("generating");
  }

  /** Back from Related activity returns to the LAST question, per the flow diagram. */
  function handleRelatedBack() {
    setQuestionIndex(Math.max(0, questions.length - 1));
    setStep("questions");
  }

  /**
   * Assembles the A3 values, then records the queue topic those answers route to.
   *
   * Derived here rather than asked as a tenth question. The requester has already said which team
   * should handle the work; asking them to also pick a queue topic would be the same decision in
   * Workfront's vocabulary instead of theirs, and Hick's Law says the extra choice costs time it
   * cannot earn back. Recording it at assembly time also means the topic reflects the answers as
   * given, before any Review edit.
   */
  async function handleGenerated() {
    const values = await defaultAssistant.assemble({ brief, registry, answers });
    const withValues: IntakeBrief = { ...brief, a3: values };
    patchBrief({ a3: values, queueTopicId: queueTopicIdFor(queueConfig, withValues) });
    setStep("draft");
  }

  /**
   * Saves the request locally and marks it Ready to send.
   *
   * `readyToSend` and `blockers` are deliberately not gated on here. An unconfigured queue is an
   * administrator's missing ID, not the requester's problem, and refusing to save their work over it
   * would lose the request entirely - there is no server copy. The queue screen shows the blockers
   * per row instead, where the person who can act on them will see them.
   */
  async function handleSubmit(edited: IntakeBrief) {
    // Review can edit the team answer, so the topic is recomputed from the edited values rather than
    // trusting the one recorded at assembly.
    const queueTopicId = queueTopicIdFor(queueConfig, edited) ?? edited.queueTopicId;
    const result = await submitToWorkfront({ ...edited, queueTopicId }, queueConfig);
    if (!result.ok) {
      setError(
        `This cannot be submitted yet. Still needed: ${result.missingFields.join(", ")}.`,
      );
      return;
    }
    const submittedAt = new Date().toISOString();
    patchBrief({
      ...edited,
      queueTopicId,
      status: "submitted",
      submittedAt,
      workfront: { mode: "local", issueName: result.issueName, submittedAt },
    });
    setStep("confirmed");
  }

  function startAnother() {
    setBrief(
      createBrief({
        identity: loadIdentity(),
        questionSetVersion: registry.version,
      }),
    );
    setAnswers({});
    setFiles([]);
    setResolutions({});
    setDismissedIds([]);
    setMatchOutcome(null);
    setAlanPrompted(false);
    setDetectionNote(null);
    setQuestionIndex(0);
    setError("");
    setStep("start");
  }

  return (
    <main id="main" className="aaa-flow">
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {error ? (
        <div role="alert" className="aaa-flow-alert">
          {error}
        </div>
      ) : null}

      {step === "start" ? (
        <StartStep
          headingRef={headingRef}
          identity={brief.identity}
          onStart={handleStart}
          onCancel={() => navigate("/")}
        />
      ) : null}

      {step === "context" ? (
        <ContextStep
          headingRef={headingRef}
          contextText={brief.contextText}
          attachments={brief.attachments}
          alanValue={alanInput}
          alanPrompted={alanPrompted}
          detectionNote={detectionNote}
          knownAlanNumbers={knownAlanNumbers}
          onAlanChange={setAlanInput}
          onRevealAlan={() => setAlanPrompted(true)}
          onAddFiles={handleFiles}
          onRemoveAttachment={removeAttachment}
          onBack={() => setStep("start")}
          onNext={handleContextNext}
        />
      ) : null}

      {step === "questions" && questions[questionIndex] ? (
        <QuestionsStep
          headingRef={headingRef}
          question={questions[questionIndex]}
          index={questionIndex}
          total={questions.length}
          value={answerFor(questions[questionIndex])}
          onChange={(value) => setAnswer(questions[questionIndex], value)}
          onBack={handleQuestionBack}
          onNext={handleQuestionNext}
          matchOutcome={matchOutcome}
          matching={matching}
        />
      ) : null}

      {step === "related" ? (
        <RelatedStep
          headingRef={headingRef}
          outcome={matchOutcome}
          matching={matching}
          resolutions={resolutions}
          complianceFlags={brief.complianceFlags}
          onResolve={handleResolve}
          onAcknowledgeFlag={(id) =>
            patchBrief({
              complianceFlags: brief.complianceFlags.map((flag) =>
                flag.id === id ? { ...flag, acknowledged: true } : flag,
              ),
            })
          }
          onBack={handleRelatedBack}
          onNext={handleRelatedNext}
        />
      ) : null}

      {step === "generating" ? (
        <GeneratingStep
          headingRef={headingRef}
          assistantLabel={defaultAssistant.label}
          onDone={handleGenerated}
        />
      ) : null}

      {step === "draft" ? (
        <ReviewStep
          headingRef={headingRef}
          brief={brief}
          registry={registry}
          queueConfig={queueConfig}
          onBack={() => setStep("related")}
          onSubmit={handleSubmit}
        />
      ) : null}

      {step === "confirmed" ? (
        <ConfirmedStep
          headingRef={headingRef}
          brief={brief}
          queueConfig={queueConfig}
          onStartAnother={startAnother}
          onHome={() => navigate("/")}
        />
      ) : null}
    </main>
  );
}
