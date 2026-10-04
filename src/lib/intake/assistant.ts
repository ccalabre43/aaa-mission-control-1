/**
 * Assembling the brief.
 *
 * This version ships a deterministic `TemplateAssistant`: no API key, no backend, no network, and
 * therefore no Vendor Management review. A later `LlmAssistant` implements the same interface
 * behind a server-side proxy without the UI changing.
 *
 * The prose shape follows `docs/briefs/aaa-life-creative-brief-annuities-example.docx`, a real
 * completed AAA Life brief. Two things are borrowed from it deliberately: goals are separated into
 * business versus marketing, and measurement is expressed with a learning objective rather than as
 * a bare KPI list. See docs/knowledge/aaa-life-brief-artifacts.md.
 */
import { assembleA3Values, type QuestionRegistry } from "./questionRegistry";
import type { A3Values } from "./a3Schema";
import type { AnswerMap, IntakeBrief } from "./types";
import { identityFullName } from "./types";

export interface AssemblyInput {
  brief: IntakeBrief;
  registry: QuestionRegistry;
  answers: AnswerMap;
}

/** Progress the UI reports. Honest steps, never a fabricated delay. */
export interface AssemblyProgress {
  step: string;
  /** 0..1 */
  fraction: number;
}

export interface IntakeAssistant {
  readonly id: string;
  /** Human-readable, shown so the requester knows what produced the draft. */
  readonly label: string;
  assemble(
    input: AssemblyInput,
    onProgress?: (progress: AssemblyProgress) => void,
  ): Promise<A3Values>;
}

function joinParagraphs(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

/**
 * Deterministic assembly.
 *
 * Every value traces to something the requester actually typed. Nothing is invented, because a
 * fabricated sentence in a compliance-reviewed document is worse than a short one.
 */
export class TemplateAssistant implements IntakeAssistant {
  readonly id = "template";
  readonly label = "Template assembly";

  async assemble(
    input: AssemblyInput,
    onProgress?: (progress: AssemblyProgress) => void,
  ): Promise<A3Values> {
    const { brief, registry, answers } = input;

    onProgress?.({ step: "Reading your answers", fraction: 0.2 });
    const values: A3Values = { ...assembleA3Values(registry, answers) };

    onProgress?.({ step: "Adding requester details", fraction: 0.4 });
    values.A3IntakeRequestedBy = identityFullName(brief.identity);

    onProgress?.({ step: "Folding in your original description", fraction: 0.6 });
    // The Context answer is the requester's own framing and should not be discarded just because
    // the guided questions covered similar ground.
    const context = brief.contextText.trim();
    if (context) {
      values.A3IntakeBackgroundPurpose = joinParagraphs([
        values.A3IntakeBackgroundPurpose,
        values.A3IntakeBackgroundPurpose
          ? `In the requester's own words:\n${context}`
          : context,
      ]);
    }

    onProgress?.({ step: "Recording supporting material", fraction: 0.8 });
    const supplemental: Array<string | undefined> = [
      values.A3IntakeSupplementalDescription,
    ];

    if (brief.attachments.length > 0) {
      supplemental.push(
        `Attachments provided by the requester:\n${brief.attachments
          .map((attachment) => `- ${attachment.fileName}`)
          .join("\n")}`,
      );
    }

    if (brief.alanNumber) {
      supplemental.push(`ALAN number supplied by the requester: ${brief.alanNumber}`);
    } else if (brief.alanAnswered) {
      supplemental.push(
        "The requester confirmed there is no ALAN number yet - this is a new piece.",
      );
    }

    const duplicates = brief.resolvedMatches.filter(
      (match) => match.resolution === "duplicate",
    );
    const related = brief.resolvedMatches.filter(
      (match) => match.resolution === "related",
    );
    if (duplicates.length > 0) {
      supplemental.push(
        `The requester marked this as a duplicate of: ${duplicates
          .map((match) => match.alanNumber ?? match.title)
          .join(", ")}.`,
      );
    }
    if (related.length > 0) {
      supplemental.push(
        `Related existing work identified by the requester: ${related
          .map((match) => match.alanNumber ?? match.title)
          .join(", ")}.`,
      );
    }

    const openFlags = brief.complianceFlags.filter(
      (flag) => flag.severity === "review",
    );
    if (openFlags.length > 0) {
      supplemental.push(
        `Compliance review requested for the following:\n${openFlags
          .map((flag) => `- ${flag.message}`)
          .join("\n")}`,
      );
    }

    const assembled = joinParagraphs(supplemental);
    if (assembled) values.A3IntakeSupplementalDescription = assembled;

    onProgress?.({ step: "Draft ready", fraction: 1 });
    return values;
  }
}

export const defaultAssistant: IntakeAssistant = new TemplateAssistant();
