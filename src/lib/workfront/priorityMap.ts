/**
 * Round-trip map between Mission Control reviewer Priority (P1–P3) and Workfront Task priority.
 *
 * Provisional (decision 052): P1→1 Urgent, P2→2 High, P3→4 Low. Admin may override later.
 */

import type { ReviewerPriority } from "../intake/types";

/** Workfront numeric priority values used on create/update. */
export type WorkfrontPriorityValue = 1 | 2 | 4;

export function toWorkfrontPriority(priority: ReviewerPriority): WorkfrontPriorityValue {
  if (priority === "P1") return 1;
  if (priority === "P3") return 4;
  return 2;
}

/**
 * Workfront priority is often numeric (1–9) or Urgent/High/Normal/Low.
 * Unrecognized → null (caller keeps local value).
 */
export function mapWorkfrontPriority(raw: string | null): ReviewerPriority | null {
  if (raw == null || String(raw).trim() === "") return null;
  const key = String(raw).trim().toLowerCase();
  if (key === "1" || key.includes("urgent") || key.includes("highest")) {
    return "P1";
  }
  if (key === "2" || key === "3" || key.includes("high")) {
    return "P2";
  }
  if (
    key === "4" ||
    key === "6" ||
    key === "7" ||
    key === "8" ||
    key === "9" ||
    key.includes("low")
  ) {
    return "P3";
  }
  if (key === "5" || key.includes("normal") || key.includes("medium")) {
    return "P2";
  }
  return null;
}

/** Contiguous 1…n ranks from an ordered list of project IDs (Portfolio Optimizer Apply). */
export function buildPortfolioRanks(
  orderedProjectIds: string[],
): Array<{ projectId: string; portfolioPriority: number }> {
  return orderedProjectIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((projectId, index) => ({
      projectId,
      portfolioPriority: index + 1,
    }));
}
