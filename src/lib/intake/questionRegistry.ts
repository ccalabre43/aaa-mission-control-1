/**
 * The guided question set, as data rather than components.
 *
 * The nine questions are a starting set, not a fixed one. The flow renders from this registry, so
 * "Question 1 of 9" becomes "Question 1 of N" automatically and the progress bar follows.
 *
 * Three rules keep an editable question set from producing an invalid Workfront payload:
 *
 * 1. A question targeting a required A3 field is LOCKED. Its wording is editable; it cannot be
 *    removed or disabled, because those six fields gate submission.
 * 2. A question can only target a field that exists in the A3 schema, or append into the
 *    designated catch-all. Adding a question never invents a Workfront field.
 * 3. The registry is versioned, and every draft snapshots the set it started with, so editing the
 *    registry cannot retroactively rewrite work in flight.
 */
import {
  A3_CATCH_ALL_FIELD,
  getA3Field,
  isA3FieldName,
  isOptionField,
  isRequiredA3Field,
  type A3FieldName,
} from "./a3Schema";
import { QUESTION_REGISTRY_KEY } from "./types";

/**
 * `checkbox` is a multi-select against the target field's own option list. It is only valid on an
 * option-bearing field, and it may produce a value naming several options - which is more than
 * Workfront's radio arity accepts. See `isSingleValueField` in a3Schema.ts for how that divergence
 * is recorded rather than hidden.
 */
export type QuestionInputType = "textarea" | "text" | "radio" | "checkbox" | "date";

export interface QuestionDef {
  id: string;
  /** The H1 on the guided-question screen. */
  label: string;
  /** One line of helper text beneath it. */
  helper: string;
  inputType: QuestionInputType;
  /** Which A3 field receives the answer. */
  target: A3FieldName;
  /**
   * When true the answer is appended into the target as a labeled block rather than replacing it,
   * so several questions can share one field without overwriting each other.
   */
  appendToTarget: boolean;
  /** Fixed options, for radio questions. Mirrors the A3 field's own options. */
  options?: readonly string[];
  /** Whether this question must be answered before Next enables. */
  required: boolean;
  /** Whether the question appears in the flow. Locked questions cannot be turned off. */
  enabled: boolean;
  /** Registry defaults cannot be deleted; user-added questions can. */
  custom: boolean;
  /**
   * Set when a question collects personal information, which triggers the PII guardrail and a
   * privacy-review flag rather than shipping quietly.
   */
  collectsPii?: boolean;
}

export interface QuestionRegistry {
  version: number;
  questions: QuestionDef[];
  updatedAt: string;
}

/**
 * The nine defaults, derived from the A3 schema. See docs/knowledge/a3-schema.md - the mapping is
 * a derivation pending `a3-creative-intake-workfront-mapping.csv`.
 *
 * Question 1's wording is verbatim from creative-request-guided-questions-interface.png.
 */
export const DEFAULT_QUESTIONS: readonly QuestionDef[] = [
  {
    id: "q-background",
    label: "What are you trying to accomplish?",
    helper: "The business objective or problem this solves.",
    inputType: "textarea",
    target: "A3IntakeBackgroundPurpose",
    appendToTarget: false,
    required: true,
    enabled: true,
    custom: false,
  },
  {
    id: "q-summary",
    label: "How would you summarize this project?",
    helper: "A short description a producer could read and understand the ask.",
    inputType: "textarea",
    target: "A3IntakeProjectSummary",
    appendToTarget: false,
    required: true,
    enabled: true,
    custom: false,
  },
  {
    id: "q-comm-type",
    label: "Which team should handle this?",
    helper:
      "Corporate Communications for internal and corporate messaging, Brand Creative Services for marketing creative. Choose both if the request needs both.",
    inputType: "checkbox",
    target: "A3IntakeCommunicationType",
    appendToTarget: false,
    options: getA3Field("A3IntakeCommunicationType").options,
    required: true,
    enabled: true,
    custom: false,
  },
  {
    id: "q-deliverables",
    label: "What do you need produced?",
    helper: "List each asset and format, for example: one direct mail piece, three digital ads.",
    inputType: "textarea",
    target: "A3IntakeDeliverables",
    appendToTarget: false,
    required: true,
    enabled: true,
    custom: false,
  },
  {
    id: "q-goals",
    label: "What are your goals and expectations?",
    helper: "Business goals and marketing goals, if they differ.",
    inputType: "textarea",
    target: "A3IntakeGoalsExpectations",
    appendToTarget: false,
    required: false,
    enabled: true,
    custom: false,
  },
  {
    id: "q-success",
    label: "How will you measure success?",
    helper: "The measures that matter, and what you need to learn from them.",
    inputType: "textarea",
    target: "A3IntakeSuccessMeasurement",
    appendToTarget: false,
    required: false,
    enabled: true,
    custom: false,
  },
  {
    id: "q-deadline",
    label: "When do you need this completed?",
    helper: "The date final assets are due.",
    inputType: "date",
    target: "A3IntakeDesiredCompletionDate",
    appendToTarget: false,
    required: true,
    enabled: true,
    custom: false,
  },
  {
    id: "q-timing",
    label: "Is the timing tied to anything?",
    helper: "A launch, an event, a media buy, or a seasonal date.",
    inputType: "textarea",
    target: "A3IntakeTimingNotes",
    appendToTarget: false,
    required: false,
    enabled: true,
    custom: false,
  },
  {
    id: "q-anything-else",
    label: "Anything else the team should know?",
    helper: "Mandatories, references, constraints, or anything that has not come up.",
    inputType: "textarea",
    target: "A3IntakeAdditionalInformation",
    appendToTarget: false,
    required: false,
    enabled: true,
    custom: false,
  },
];

/** Bumped to 2 when the team-routing question became multi-select. */
export const DEFAULT_REGISTRY_VERSION = 2;

export function defaultRegistry(): QuestionRegistry {
  return {
    version: DEFAULT_REGISTRY_VERSION,
    questions: DEFAULT_QUESTIONS.map((question) => ({ ...question })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * A question is locked when its target A3 field is required. Locked questions can be reworded but
 * never removed or disabled, because removing one guarantees a rejected submission.
 */
export function isLocked(question: QuestionDef): boolean {
  return !question.custom && isRequiredA3Field(question.target);
}

export interface RegistryProblem {
  questionId: string;
  message: string;
}

/**
 * Validates the registry. Returns problems rather than throwing, so the admin view can explain
 * what is wrong instead of the flow breaking at question four.
 */
export function validateRegistry(registry: QuestionRegistry): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const seen = new Set<string>();

  for (const question of registry.questions) {
    if (seen.has(question.id)) {
      problems.push({ questionId: question.id, message: "Duplicate question id." });
    }
    seen.add(question.id);

    if (!question.label.trim()) {
      problems.push({ questionId: question.id, message: "A question needs a label." });
    }

    // Rule 2: never target a field Workfront does not have.
    if (!isA3FieldName(question.target)) {
      problems.push({
        questionId: question.id,
        message: `"${question.target}" is not a Workfront field on the A3 form. Target an existing field or append into ${A3_CATCH_ALL_FIELD}.`,
      });
      continue;
    }

    // Rule 1: locked questions must stay in the flow.
    if (isLocked(question) && !question.enabled) {
      problems.push({
        questionId: question.id,
        message: `${getA3Field(question.target).label} is required by Workfront, so this question cannot be turned off.`,
      });
    }

    const field = getA3Field(question.target);
    // An option-bearing field may be asked as one choice or several. Anything else - a textarea
    // over a fixed option list - would let a requester type a value Workfront does not offer.
    if (
      isOptionField(question.target) &&
      question.inputType !== "radio" &&
      question.inputType !== "checkbox"
    ) {
      problems.push({
        questionId: question.id,
        message: `${field.label} has fixed options in Workfront, so this question must offer those choices rather than free text.`,
      });
    }
    // The reverse: choices with nothing to choose from.
    if (
      (question.inputType === "radio" || question.inputType === "checkbox") &&
      !isOptionField(question.target)
    ) {
      problems.push({
        questionId: question.id,
        message: `${field.label} has no fixed options in Workfront, so this question cannot offer choices.`,
      });
    }
    if (field.type === "date" && question.inputType !== "date") {
      problems.push({
        questionId: question.id,
        message: `${field.label} is a date field in Workfront, so this question must use a date picker.`,
      });
    }
    // Only paragraph fields can hold several appended answers.
    if (question.appendToTarget && field.type !== "paragraph") {
      problems.push({
        questionId: question.id,
        message: `${field.label} is not a paragraph field, so answers cannot be appended to it.`,
      });
    }
  }

  return problems;
}

/** Questions actually asked, in order. */
export function activeQuestions(registry: QuestionRegistry): QuestionDef[] {
  return registry.questions.filter((question) => question.enabled);
}

/**
 * Deletable means "not feeding a field Workfront requires."
 *
 * This deliberately coincides with `canDisable`: the same five questions are undeletable and
 * undisableable, for the same single reason, so neither predicate is the stricter one. Both exist
 * because the screen needs to say two different things about the same fact.
 *
 * It previously also required `question.custom`, which made the four optional built-ins permanent by
 * accident rather than by rule - the registry has `resetRegistry` to bring back a default, so
 * refusing to delete one bought nothing. `validateRegistry` cannot backstop this: it checks that a
 * locked question is not *disabled*, and a deleted question is not there to check, so the gate has to
 * hold here.
 */
export function canRemove(question: QuestionDef): boolean {
  return !isLocked(question);
}

export function canDisable(question: QuestionDef): boolean {
  return !isLocked(question);
}

/** A new custom question. Defaults to the catch-all field, which always accepts an append. */
export function createCustomQuestion(
  partial: Partial<QuestionDef> = {},
): QuestionDef {
  return {
    id: `q-custom-${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    helper: "",
    inputType: "textarea",
    target: A3_CATCH_ALL_FIELD,
    appendToTarget: true,
    required: false,
    enabled: true,
    custom: true,
    ...partial,
  };
}

export function moveQuestion(
  registry: QuestionRegistry,
  id: string,
  direction: -1 | 1,
): QuestionRegistry {
  const questions = [...registry.questions];
  const index = questions.findIndex((question) => question.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= questions.length) return registry;
  [questions[index], questions[target]] = [questions[target], questions[index]];
  return { ...registry, questions, updatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

function normalizeQuestion(value: unknown): QuestionDef | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const target = typeof raw.target === "string" ? raw.target : "";
  if (!id || !isA3FieldName(target)) return null;

  const inputType = raw.inputType;
  const custom = raw.custom === true;
  const question: QuestionDef = {
    id,
    label: typeof raw.label === "string" ? raw.label : "",
    helper: typeof raw.helper === "string" ? raw.helper : "",
    inputType:
      inputType === "text" ||
      inputType === "radio" ||
      inputType === "checkbox" ||
      inputType === "date"
        ? inputType
        : "textarea",
    target,
    appendToTarget: raw.appendToTarget === true,
    options: getA3Field(target).options,
    required: raw.required === true,
    enabled: raw.enabled !== false,
    custom,
    collectsPii: raw.collectsPii === true ? true : undefined,
  };
  // A locked question is force-enabled on load, so a hand-edited or corrupted registry cannot
  // silently drop a Workfront-required field out of the flow.
  if (isLocked(question)) question.enabled = true;
  return question;
}

export function loadRegistry(): QuestionRegistry {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(QUESTION_REGISTRY_KEY);
  } catch {
    return defaultRegistry();
  }
  if (!raw) return defaultRegistry();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultRegistry();
    const obj = parsed as Record<string, unknown>;
    const questions = Array.isArray(obj.questions)
      ? obj.questions
          .map(normalizeQuestion)
          .filter((question): question is QuestionDef => question !== null)
      : [];

    // A stored registry missing a Workfront-required question is repaired from defaults rather
    // than trusted, since the alternative is an unsubmittable flow.
    const targets = new Set(questions.map((question) => question.target));
    for (const fallback of DEFAULT_QUESTIONS) {
      if (isRequiredA3Field(fallback.target) && !targets.has(fallback.target)) {
        questions.push({ ...fallback });
      }
    }
    if (questions.length === 0) return defaultRegistry();

    return {
      version:
        typeof obj.version === "number" ? obj.version : DEFAULT_REGISTRY_VERSION,
      questions,
      updatedAt:
        typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
    };
  } catch {
    return defaultRegistry();
  }
}

/** Bumps the version so drafts can tell they were started against an older set. */
export function saveRegistry(registry: QuestionRegistry): QuestionRegistry {
  const next: QuestionRegistry = {
    ...registry,
    version: registry.version + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(QUESTION_REGISTRY_KEY, JSON.stringify(next));
  } catch {
    /* the caller surfaces save failures; the in-memory set still works for this session */
  }
  return next;
}

export function resetRegistry(): QuestionRegistry {
  try {
    localStorage.removeItem(QUESTION_REGISTRY_KEY);
  } catch {
    /* nothing useful to do */
  }
  return defaultRegistry();
}

/**
 * Assembles A3 values from answers.
 *
 * Answers to questions that were later disabled are retained in storage and simply not assembled,
 * so turning a question back on restores its content instead of having discarded it.
 */
export function assembleA3Values(
  registry: QuestionRegistry,
  answers: Record<string, string>,
): Partial<Record<A3FieldName, string>> {
  const values: Partial<Record<A3FieldName, string>> = {};
  for (const question of activeQuestions(registry)) {
    const answer = (answers[question.id] ?? "").trim();
    if (!answer) continue;
    if (question.appendToTarget) {
      const block = `${question.label.trim()}\n${answer}`;
      values[question.target] = values[question.target]
        ? `${values[question.target]}\n\n${block}`
        : block;
    } else {
      values[question.target] = answer;
    }
  }
  return values;
}
