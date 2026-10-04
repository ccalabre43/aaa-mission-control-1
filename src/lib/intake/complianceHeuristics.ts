/**
 * Compliance heuristics over the requester's own words.
 *
 * These are deliberately modest. They are pattern matches drawn from the advertising baseline in
 * `.cursor/rules/aaa-company-guardrails.mdc`, and they exist to prompt a human, never to clear one.
 * Compliance is the second line of defense; this is a nudge at the first line.
 *
 * Two rules govern the design:
 *
 * - A flag never blocks. The requester may proceed with the flag attached, and the flag travels
 *   with the brief rather than being dropped, because the Sprint 2 reviewer's gate path depends on
 *   whether a flag exists.
 * - Every flag names what triggered it, so it is auditable rather than mysterious. A flag a
 *   requester cannot understand gets acknowledged reflexively, which is worse than no flag.
 */
import type { ComplianceFlag } from "./types";

interface Heuristic {
  rule: string;
  /** Matched case-insensitively against the combined request text. */
  patterns: RegExp[];
  message: string;
  severity: ComplianceFlag["severity"];
}

const HEURISTICS: Heuristic[] = [
  {
    rule: "guaranteed-claims",
    patterns: [
      /\bguarantee(d|s)?\b/i,
      /\bno\s+(?:one|body)\s+is\s+turned\s+down\b/i,
      /\bacceptance\s+is\s+guaranteed\b/i,
      /\bcan'?t\s+be\s+(?:turned\s+down|declined)\b/i,
    ],
    message:
      "This mentions a guarantee. Guaranteed coverage or rates must be qualified, and this wording needs Compliance review before it ships.",
    severity: "review",
  },
  {
    rule: "no-medical-exam",
    patterns: [/\bno\s+medical\s+exam\b/i, /\bno\s+health\s+questions\b/i, /\bno\s+exam\b/i],
    message:
      "A \"no medical exam\" claim has to be accurate and qualified for the specific product. Confirm it with Compliance and name the product it applies to.",
    severity: "review",
  },
  {
    rule: "government-affiliation",
    patterns: [
      /\bgovernment\s+(?:approved|endorsed|program|benefit)\b/i,
      /\bfederal\s+(?:program|benefit)\b/i,
      /\bmedicare[- ]approved\b/i,
      /\bofficial\s+government\b/i,
    ],
    message:
      "This could imply government affiliation or endorsement, which is not permitted. Reword or route to Compliance.",
    severity: "review",
  },
  {
    rule: "testimonials",
    patterns: [/\btestimonial/i, /\breview(s)?\s+from\s+(?:real\s+)?(?:customers|members)\b/i, /\binfluencer\b/i, /\bendorsement\b/i],
    message:
      "Testimonials and endorsements must be genuine, current, and representative, with FTC disclosure. Flagging so the sourcing is confirmed.",
    severity: "review",
  },
  {
    rule: "urgency-and-scare",
    patterns: [
      /\b(?:act|call)\s+now\b/i,
      /\blast\s+chance\b/i,
      /\bdon'?t\s+(?:wait|delay)\b/i,
      /\bbefore\s+it'?s\s+too\s+late\b/i,
      /\bleave\s+your\s+family\s+with\s+nothing\b/i,
      /\bburden\s+(?:your|their)\s+(?:family|loved\s+ones)\b/i,
      /\bwhile\s+you\s+still\s+can\b/i,
    ],
    message:
      "This reads as urgency or scare-based messaging. Senior-targeted copy in particular must avoid scare tactics and false urgency. Worth a Compliance look.",
    severity: "review",
  },
  {
    rule: "comparative-claims",
    patterns: [
      /\b(?:better|cheaper|lower)\s+than\s+(?:any|all|every|other)\b/i,
      /\bbeat(?:s)?\s+(?:any|all|every)\s+(?:other\s+)?(?:price|rate|competitor)\b/i,
      /\b(?:best|lowest)\s+(?:rate|price)s?\s+(?:anywhere|available|guaranteed)\b/i,
    ],
    message:
      "Comparative or superlative claims about rates must be substantiated and not misleading. Flagging for Compliance.",
    severity: "review",
  },
  {
    rule: "pii-in-request",
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN shape
      /\bpolicy\s*(?:#|number|no\.?)\s*[:#]?\s*\w{4,}/i,
      /\b\d{16}\b/, // card-shaped
      /\bdate\s+of\s+birth\b/i,
    ],
    message:
      "This looks like it contains customer personal information such as a policy number, date of birth, or similar. Remove it from the request - customer data must not be entered here.",
    severity: "review",
  },
  {
    rule: "state-availability",
    patterns: [/\ball\s+(?:50\s+)?states\b/i, /\bnationwide\s+coverage\b/i, /\bavailable\s+everywhere\b/i],
    message:
      "AAA Life is licensed in all states except New York, and products and features vary by state. This needs the state-availability disclaimer.",
    severity: "info",
  },
];

export interface ComplianceScanInput {
  contextText: string;
  answers: Record<string, string>;
}

/**
 * Scans the request. Returns flags in a stable order so re-running does not shuffle the list under
 * a requester who is reading it.
 */
export function scanForComplianceFlags(
  input: ComplianceScanInput,
): ComplianceFlag[] {
  const segments: Array<{ field: string; text: string }> = [
    { field: "Context", text: input.contextText },
    ...Object.entries(input.answers).map(([id, text]) => ({ field: id, text })),
  ];

  const flags: ComplianceFlag[] = [];
  const firedRules = new Set<string>();

  for (const heuristic of HEURISTICS) {
    for (const segment of segments) {
      if (!segment.text.trim()) continue;
      const hit = heuristic.patterns.find((pattern) => pattern.test(segment.text));
      if (!hit) continue;
      if (firedRules.has(heuristic.rule)) break;
      firedRules.add(heuristic.rule);
      flags.push({
        // Deterministic id so re-scanning does not duplicate a flag the user already acknowledged.
        id: `flag-${heuristic.rule}`,
        rule: heuristic.rule,
        message: heuristic.message,
        severity: heuristic.severity,
        sourceField: segment.field,
        raisedAt: new Date().toISOString(),
        acknowledged: false,
      });
      break;
    }
  }

  return flags;
}

/**
 * Merges a fresh scan with existing flags, keeping acknowledgements. Re-asking a requester to
 * dismiss the same flag after every keystroke would train them to dismiss without reading.
 */
export function mergeComplianceFlags(
  existing: ComplianceFlag[],
  fresh: ComplianceFlag[],
): ComplianceFlag[] {
  const acknowledged = new Map(
    existing.filter((flag) => flag.acknowledged).map((flag) => [flag.id, flag]),
  );
  return fresh.map((flag) => {
    const previous = acknowledged.get(flag.id);
    return previous ? { ...flag, acknowledged: true, raisedAt: previous.raisedAt } : flag;
  });
}
