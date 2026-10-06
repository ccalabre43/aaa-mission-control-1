/**
 * Sample requests for developing the Request Queue against a populated list.
 *
 * The queue's interesting behavior - filters, sorting, both-teams triage, a compliance flag, a
 * request that routed by inference rather than by record - only shows up when there is a spread of
 * data to exercise it. Reaching that state by hand means walking the seven-step flow several times
 * before every change, which is how people end up testing only the path they just typed.
 *
 * Three rules make this safe to keep in the shipped bundle rather than hiding it behind a dev flag:
 *
 * 1. **Every requester is fake and obviously so.** Names are roles, not people, and addresses use
 *    `example.invalid`, the reserved TLD from RFC 2606 that can never resolve. No real colleague's
 *    name or address goes in a fixture, because a fixture gets committed and a committed name is PII
 *    in a repository.
 * 2. **Every title is prefixed `SAMPLE`.** Visible in the queue, in a match card, and in an exported
 *    snapshot, so sample data can never be mistaken for a real request at a glance.
 * 3. **Ids are fixed and namespaced `sample-`.** Loading is an upsert, so clicking twice does not
 *    duplicate anything, and removal deletes exactly these ids and nothing else. Loading samples
 *    therefore cannot damage real work, which is why this needs no confirmation step.
 *
 * Not a test fixture in the automated sense - `verify-flow.mjs` still drives the real flow, because a
 * seeded brief proves nothing about whether the flow that creates one works.
 */
import { A3_COMMUNICATION_TYPES } from "../intake/a3Schema";
import { createBrief, type IntakeBrief } from "../intake/types";

export const SAMPLE_ID_PREFIX = "sample-";
export const SAMPLE_TITLE_PREFIX = "SAMPLE";

const [CORPORATE, BRAND] = A3_COMMUNICATION_TYPES;

/** Fixed dates, so the queue's sort order and relative ages are reproducible across runs. */
const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-09-15T14:00:00.000Z");
const at = (daysAfter: number) => new Date(BASE + daysAfter * DAY).toISOString();

function sample(
  id: string,
  overrides: Partial<IntakeBrief> & { a3: IntakeBrief["a3"] },
): IntakeBrief {
  return createBrief({ id: `${SAMPLE_ID_PREFIX}${id}`, ...overrides });
}

/**
 * Five requests chosen to cover the states the queue renders differently, not to look plentiful.
 *
 * - `001` ready to send, routed by a recorded topic, single team
 * - `002` still a draft, so the queue's Submit action has something to act on
 * - `003` both teams, which is the triage topic and the multi-value audit line
 * - `004` carries a review-severity compliance flag
 * - `005` has no `queueTopicId`, so the queue must infer a route and say that it inferred it
 */
export function sampleBriefs(): IntakeBrief[] {
  return [
    sample("001", {
      status: "submitted",
      createdAt: at(0),
      updatedAt: at(0),
      submittedAt: at(0),
      identity: {
        firstName: "Sample",
        lastName: "Requester",
        email: "sample.requester@example.invalid",
        department: "Marketing",
      },
      contextText:
        "We need a one-page flyer for the term life renewal push going out to existing members next month.",
      alanNumber: "ALAN-29541-624-00",
      alanAnswered: true,
      answers: {
        "q-background": "Renewal season, and last year's flyer is out of date.",
        "q-summary": "SAMPLE - One-page term life renewal flyer for existing members.",
        "q-comm-type": BRAND,
        "q-deliverables": "Print flyer, one page, double sided.",
        "q-goals": "Lift renewal rate against last season.",
        "q-success": "Renewal response rate.",
        "q-deadline": at(30).slice(0, 10),
        "q-timing": "Needs to reach the printer two weeks before the mail date.",
        "q-anything-else": "Reuse last year's photography if it is still licensed.",
      },
      a3: {
        A3IntakeRequestedBy: "Sample Requester",
        A3IntakeCommunicationType: BRAND,
        A3IntakeProjectSummary: "SAMPLE - One-page term life renewal flyer for existing members.",
        A3IntakeBackgroundPurpose: "Renewal season, and last year's flyer is out of date.",
        A3IntakeDeliverables: "Print flyer, one page, double sided.",
        A3IntakeGoalsExpectations: "Lift renewal rate against last season.",
        A3IntakeSuccessMeasurement: "Renewal response rate.",
        A3IntakeDesiredCompletionDate: at(30).slice(0, 10),
        A3IntakeTimingNotes: "Needs to reach the printer two weeks before the mail date.",
        A3IntakeAdditionalInformation: "Reuse last year's photography if it is still licensed.",
      },
      queueTopicId: "topic-brand-creative-services",
      workfront: {
        mode: "local",
        issueName: `${SAMPLE_TITLE_PREFIX} - term life renewal flyer`,
        submittedAt: at(0),
      },
    }),

    sample("002", {
      status: "draft",
      createdAt: at(2),
      updatedAt: at(3),
      identity: {
        firstName: "Sample",
        lastName: "Colleague",
        email: "sample.colleague@example.invalid",
        department: "Internal Communications",
      },
      contextText:
        "Draft announcement for the new employee benefits portal. Still waiting on the launch date.",
      alanNumber: null,
      alanAnswered: true,
      answers: {
        "q-background": "The benefits portal is being replaced and staff need to know.",
        "q-summary": "SAMPLE - Internal announcement for the new employee benefits portal.",
        "q-comm-type": CORPORATE,
      },
      a3: {
        A3IntakeRequestedBy: "Sample Colleague",
        A3IntakeCommunicationType: CORPORATE,
        A3IntakeProjectSummary: "SAMPLE - Internal announcement for the new employee benefits portal.",
        A3IntakeBackgroundPurpose: "The benefits portal is being replaced and staff need to know.",
      },
      queueTopicId: "topic-corporate-communications",
    }),

    sample("003", {
      status: "submitted",
      createdAt: at(4),
      updatedAt: at(5),
      submittedAt: at(5),
      identity: {
        firstName: "Sample",
        lastName: "Manager",
        email: "sample.manager@example.invalid",
        department: "Product",
      },
      contextText:
        "Annuities campaign that needs an internal rollout note for agents and external creative for members.",
      alanNumber: "ALAN-30112-108-02",
      alanAnswered: true,
      answers: {
        "q-background": "New annuities product launching in the spring.",
        "q-summary": "SAMPLE - Annuities launch campaign, internal and external.",
        // Both teams selected, which is what the triage topic exists for.
        "q-comm-type": `${CORPORATE}, ${BRAND}`,
        "q-deliverables": "Agent rollout email, member landing page, two social posts.",
        "q-deadline": at(60).slice(0, 10),
      },
      a3: {
        A3IntakeRequestedBy: "Sample Manager",
        A3IntakeCommunicationType: `${CORPORATE}, ${BRAND}`,
        A3IntakeProjectSummary: "SAMPLE - Annuities launch campaign, internal and external.",
        A3IntakeBackgroundPurpose: "New annuities product launching in the spring.",
        A3IntakeDeliverables: "Agent rollout email, member landing page, two social posts.",
        A3IntakeDesiredCompletionDate: at(60).slice(0, 10),
      },
      queueTopicId: "topic-both-teams",
      workfront: {
        mode: "local",
        issueName: `${SAMPLE_TITLE_PREFIX} - annuities launch campaign`,
        submittedAt: at(5),
      },
    }),

    sample("004", {
      status: "submitted",
      createdAt: at(6),
      updatedAt: at(6),
      submittedAt: at(6),
      identity: {
        firstName: "Sample",
        lastName: "Producer",
        email: "sample.producer@example.invalid",
        department: "Marketing",
      },
      contextText:
        "Direct mail piece for final expense. The draft copy says coverage is guaranteed with no medical exam.",
      alanNumber: "ALAN-29877-203-01",
      alanAnswered: true,
      answers: {
        "q-background": "Final expense direct mail test for a senior audience.",
        "q-summary": "SAMPLE - Final expense direct mail test.",
        "q-comm-type": BRAND,
        "q-deliverables": "Letter and reply card.",
        "q-deadline": at(21).slice(0, 10),
      },
      a3: {
        A3IntakeRequestedBy: "Sample Producer",
        A3IntakeCommunicationType: BRAND,
        A3IntakeProjectSummary: "SAMPLE - Final expense direct mail test.",
        A3IntakeBackgroundPurpose: "Final expense direct mail test for a senior audience.",
        A3IntakeDeliverables: "Letter and reply card.",
        A3IntakeDesiredCompletionDate: at(21).slice(0, 10),
      },
      /*
       * A real flag shape rather than a decorative one, so the Compliance gate and the review panel
       * have something true to render. The wording matches what complianceHeuristics raises for an
       * unqualified guarantee, which is a genuine advertising-baseline issue under guardrail 2.
       */
      complianceFlags: [
        {
          id: `${SAMPLE_ID_PREFIX}flag-001`,
          rule: "guaranteed-coverage",
          message:
            "The context mentions guaranteed coverage and no medical exam. Both need qualification, and Compliance owns the final wording.",
          severity: "review",
          sourceField: "contextText",
          raisedAt: at(6),
          acknowledged: false,
        },
      ],
      queueTopicId: "topic-brand-creative-services",
      workfront: {
        mode: "local",
        issueName: `${SAMPLE_TITLE_PREFIX} - final expense direct mail`,
        submittedAt: at(6),
      },
    }),

    sample("005", {
      status: "submitted",
      createdAt: at(8),
      updatedAt: at(8),
      submittedAt: at(8),
      identity: {
        firstName: "Sample",
        lastName: "Analyst",
        email: "sample.analyst@example.invalid",
        department: "Corporate Communications",
      },
      contextText: "Quarterly all-hands deck refresh.",
      alanNumber: null,
      alanAnswered: false,
      answers: {
        "q-summary": "SAMPLE - Quarterly all-hands deck refresh.",
        "q-comm-type": CORPORATE,
      },
      a3: {
        A3IntakeRequestedBy: "Sample Analyst",
        A3IntakeCommunicationType: CORPORATE,
        A3IntakeProjectSummary: "SAMPLE - Quarterly all-hands deck refresh.",
      },
      /*
       * Deliberately null. This is what every brief saved before queue topics existed looks like, so
       * the queue has to derive a route from the communication type and label it as derived. Without
       * one of these, that path only runs against historical data nobody has anymore.
       */
      queueTopicId: null,
      workfront: {
        mode: "local",
        issueName: `${SAMPLE_TITLE_PREFIX} - all-hands deck refresh`,
        submittedAt: at(8),
      },
    }),
  ];
}

export function isSampleBrief(brief: { id: string }): boolean {
  return brief.id.startsWith(SAMPLE_ID_PREFIX);
}

export function countSampleBriefs(briefs: Array<{ id: string }>): number {
  return briefs.filter(isSampleBrief).length;
}

/**
 * Upsert by id, so loading twice is idempotent and real requests are never touched.
 *
 * Samples go after real requests rather than at the top: the newest real work should stay where the
 * user left it, not get pushed down the list by fixtures.
 */
export function withSamples(briefs: IntakeBrief[]): IntakeBrief[] {
  return [...briefs.filter((brief) => !isSampleBrief(brief)), ...sampleBriefs()];
}

export function withoutSamples(briefs: IntakeBrief[]): IntakeBrief[] {
  return briefs.filter((brief) => !isSampleBrief(brief));
}
