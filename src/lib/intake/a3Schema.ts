/**
 * The A3 Creative Intake custom form, encoded from the real Workfront Issue/Request form.
 *
 * Source: assets/mocks/intake-brief-example.jpg, which shows the live form with its internal
 * `Name` values exposed in gray captions. Documented in docs/knowledge/a3-schema.md.
 *
 * The internal names below ARE the contract with Workfront. They are not stylistic choices and
 * must not be renamed to something friendlier. Nothing may be added here that does not exist on
 * the real form: the app never invents a Workfront field.
 *
 * Open item: the form's own footer cites `a3-creative-intake-workfront-mapping.csv` as the
 * authority for types and internal names. That file has not been provided, so the field types
 * below are read from the form's captions and the question mapping is a derivation. When the CSV
 * lands, this file is the single place that changes.
 */

/** Workfront custom-form field types, as captioned on the form. */
export type A3FieldType =
  | "descriptive" // display-only text, never submitted
  | "single-line"
  | "paragraph"
  | "radio"
  | "date"
  | "attachment";

/** Internal Workfront field names. Exact strings. */
export const A3_FIELD_NAMES = [
  "A3IntakeFormIntro",
  "A3IntakeRequestedBy",
  "A3IntakeCommunicationType",
  "A3IntakeAdditionalInformation",
  "A3IntakeBackgroundPurpose",
  "A3IntakeProjectSummary",
  "A3IntakeDeliverables",
  "A3IntakeGoalsExpectations",
  "A3IntakeSuccessMeasurement",
  "A3IntakeDesiredCompletionDate",
  "A3IntakeTimingNotes",
  "A3IntakeSupplementalDescription",
  "A3IntakeSupportingFiles",
] as const;

export type A3FieldName = (typeof A3_FIELD_NAMES)[number];

/** The form's visual section groupings, in order, as drawn. */
export const A3_SECTIONS = [
  "Introduction",
  "Requester",
  "General information",
  "Background and project details",
  "Deliverables and outcomes",
  "Project timing",
  "Additional information",
  "Attachments",
] as const;

export type A3Section = (typeof A3_SECTIONS)[number];

export interface A3Field {
  /** Internal Workfront name. The contract. */
  name: A3FieldName;
  /** Label as drawn on the form. */
  label: string;
  type: A3FieldType;
  section: A3Section;
  /** Asterisked on the form. Required fields gate submission. */
  required: boolean;
  /** Fixed options, for radio fields. */
  options?: readonly string[];
  /** Accepted file kinds, for attachment fields. */
  accepts?: string;
}

export const A3_COMMUNICATION_TYPES = [
  "Corporate Communications",
  "Brand Creative Services",
] as const;

export type A3CommunicationType = (typeof A3_COMMUNICATION_TYPES)[number];

/**
 * The form, in the order it is drawn. Order matters: it is the order a producer reads the Issue
 * in Workfront, and the order the assembled brief is rendered for review.
 */
export const A3_FIELDS: readonly A3Field[] = [
  {
    name: "A3IntakeFormIntro",
    label: "How to use this intake form",
    type: "descriptive",
    section: "Introduction",
    required: false,
  },
  {
    name: "A3IntakeRequestedBy",
    label: "Requested By",
    type: "single-line",
    section: "Requester",
    required: true,
  },
  {
    /**
     * Radio on the real form, which means Workfront accepts exactly ONE of the options.
     *
     * The app deliberately allows a requester to pick both teams, because a request can genuinely
     * need internal communications and marketing creative. That is a known divergence from the
     * field's arity, dated in docs/decisions/decision-log.md and raised as a Workfront
     * configuration request to convert this to a checkbox group. Until that lands, a two-team
     * answer also rides in the Issue description as an audit line so routing is not lost if
     * Workfront collapses the value. See `isSingleValueField`.
     */
    name: "A3IntakeCommunicationType",
    label: "Communication Type",
    type: "radio",
    section: "General information",
    required: true,
    options: A3_COMMUNICATION_TYPES,
  },
  {
    name: "A3IntakeAdditionalInformation",
    label: "Additional Information",
    type: "paragraph",
    section: "General information",
    required: false,
  },
  {
    name: "A3IntakeBackgroundPurpose",
    label: "Background and Business Purposes",
    type: "paragraph",
    section: "Background and project details",
    required: true,
  },
  {
    name: "A3IntakeProjectSummary",
    label: "Project Summary",
    type: "paragraph",
    section: "Background and project details",
    required: true,
  },
  {
    name: "A3IntakeDeliverables",
    label: "Deliverables",
    type: "paragraph",
    section: "Deliverables and outcomes",
    required: true,
  },
  {
    name: "A3IntakeGoalsExpectations",
    label: "Goals and Expectations",
    type: "paragraph",
    section: "Deliverables and outcomes",
    required: false,
  },
  {
    name: "A3IntakeSuccessMeasurement",
    label: "Success Measurement",
    type: "paragraph",
    section: "Deliverables and outcomes",
    required: false,
  },
  {
    name: "A3IntakeDesiredCompletionDate",
    label: "Desired Project Completion Date",
    type: "date",
    section: "Project timing",
    required: true,
  },
  {
    name: "A3IntakeTimingNotes",
    label: "Project Timing Information",
    type: "paragraph",
    section: "Project timing",
    required: false,
  },
  {
    name: "A3IntakeSupplementalDescription",
    label: "Additional Information Description",
    type: "paragraph",
    section: "Additional information",
    required: false,
  },
  {
    name: "A3IntakeSupportingFiles",
    label: "Supporting files",
    type: "attachment",
    section: "Attachments",
    required: false,
    accepts: "Images, PDFs, videos",
  },
];

/** Descriptive copy shown on the real form's introduction. */
export const A3_INTRO_TEXT =
  "Complete all sections. Values map to the Workfront Issue / Request custom form. Required fields are marked with an asterisk.";

const FIELD_INDEX = new Map<A3FieldName, A3Field>(
  A3_FIELDS.map((field) => [field.name, field]),
);

export function getA3Field(name: A3FieldName): A3Field {
  const field = FIELD_INDEX.get(name);
  // A missing field means the schema and a caller have drifted apart, which would silently
  // produce an invalid Workfront payload. Fail loudly instead.
  if (!field) throw new Error(`Unknown A3 field: ${name}`);
  return field;
}

export function isA3FieldName(value: string): value is A3FieldName {
  return FIELD_INDEX.has(value as A3FieldName);
}

/** Fields that are actually submitted. Descriptive text is display-only. */
export const A3_SUBMITTED_FIELDS = A3_FIELDS.filter(
  (field) => field.type !== "descriptive",
);

/** The six asterisked fields. These gate submission. */
export const A3_REQUIRED_FIELDS = A3_FIELDS.filter((field) => field.required);

export const A3_REQUIRED_FIELD_NAMES: readonly A3FieldName[] =
  A3_REQUIRED_FIELDS.map((field) => field.name);

export function isRequiredA3Field(name: A3FieldName): boolean {
  return getA3Field(name).required;
}

/* ------------------------------------------------------------------ *
 * Option-bearing fields
 *
 * One field currently carries a fixed option list, but nothing below names it. A component that
 * hardcoded `A3IntakeCommunicationType` would have to be found and edited the day the mapping CSV
 * adds a second option field, which is exactly the drift this schema exists to prevent.
 * ------------------------------------------------------------------ */

/** A field with a fixed option list, so a question against it renders choices rather than a box. */
export function isOptionField(name: A3FieldName): boolean {
  const options = getA3Field(name).options;
  return Boolean(options && options.length > 0);
}

/**
 * Whether Workfront will accept only one of the field's options.
 *
 * Radio is single-value on the real form. The app may still submit several - see the note on
 * `A3IntakeCommunicationType` - so this is what lets the payload builder notice the divergence and
 * write an audit line instead of shipping it silently.
 */
export function isSingleValueField(name: A3FieldName): boolean {
  return getA3Field(name).type === "radio";
}

/**
 * Separator for several option values inside one field value.
 *
 * A joined string rather than an array because answers persist as `Record<string, string>` and a
 * saved draft would otherwise need a storage migration. None of the current option values contain
 * a comma; `parseOptionValues` validates against the real option list regardless, so a value that
 * somehow does cannot smuggle a phantom option into the payload.
 */
export const OPTION_VALUE_SEPARATOR = ", ";

/**
 * Reads a stored field value back into the options it names.
 *
 * Tokens that are not real options are dropped rather than trusted, so a hand-edited
 * `localStorage` entry or a half-written value degrades to the options it did get right instead of
 * poisoning a Workfront payload. Returns them in schema order, which makes this idempotent with
 * `formatOptionValues`.
 */
export function parseOptionValues(
  value: string | undefined,
  options?: readonly string[],
): string[] {
  const tokens = (value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (!options || options.length === 0) return [...new Set(tokens)];
  return options.filter((option) => tokens.includes(option));
}

/**
 * Canonical string for a set of selected options.
 *
 * Emitted in the schema's option order, never click order, so two requesters who pick the same two
 * teams produce byte-identical values. The matcher compares this text and a reviewer may diff two
 * briefs, and neither should see a difference that is only the order someone clicked in.
 */
export function formatOptionValues(
  selected: readonly string[],
  options?: readonly string[],
): string {
  const chosen = new Set(selected);
  const ordered = options
    ? options.filter((option) => chosen.has(option))
    : [...chosen];
  return ordered.join(OPTION_VALUE_SEPARATOR);
}

/** Adds or removes one option from a stored value, returning the new canonical string. */
export function toggleOptionValue(
  value: string | undefined,
  option: string,
  options?: readonly string[],
): string {
  const current = parseOptionValues(value, options);
  const next = current.includes(option)
    ? current.filter((item) => item !== option)
    : [...current, option];
  return formatOptionValues(next, options);
}

/**
 * Fields that accept free-form narrative and can therefore absorb a custom question's answer.
 * `A3IntakeSupplementalDescription` is the designated catch-all.
 */
export const A3_PARAGRAPH_FIELD_NAMES: readonly A3FieldName[] = A3_FIELDS.filter(
  (field) => field.type === "paragraph",
).map((field) => field.name);

export const A3_CATCH_ALL_FIELD: A3FieldName = "A3IntakeSupplementalDescription";

/** Values keyed by internal Workfront name. Dates are ISO `YYYY-MM-DD`. */
export type A3Values = Partial<Record<A3FieldName, string>>;

export interface A3ValidationResult {
  valid: boolean;
  /** Required fields with no value, in form order, so the UI can name the first blocker. */
  missing: A3Field[];
}

export function validateA3(values: A3Values): A3ValidationResult {
  const missing = A3_REQUIRED_FIELDS.filter(
    (field) => !(values[field.name] ?? "").trim(),
  );
  return { valid: missing.length === 0, missing };
}

/**
 * Groups submitted fields by section, preserving form order, for rendering the assembled brief.
 * Empty optional fields are dropped so a reviewer is not reading a page of blank headings.
 */
export function groupA3BySection(
  values: A3Values,
): Array<{ section: A3Section; fields: A3Field[] }> {
  const groups: Array<{ section: A3Section; fields: A3Field[] }> = [];
  for (const field of A3_SUBMITTED_FIELDS) {
    if (field.type === "attachment") continue;
    if (!(values[field.name] ?? "").trim()) continue;
    const last = groups[groups.length - 1];
    if (last && last.section === field.section) last.fields.push(field);
    else groups.push({ section: field.section, fields: [field] });
  }
  return groups;
}
