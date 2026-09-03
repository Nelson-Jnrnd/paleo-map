/**
 * Stage stepping (SPEC-009 REQ-001, SPEC-030 REQ-006).
 *
 * Pure, and shared by the two surfaces that step the age: the full to-scale
 * timeline and the phone's age strip. The ordering rule — `stages` runs oldest
 * to youngest, so "older" is one index down — lives here once rather than in
 * both, because two copies of an off-by-one are how the two controls end up
 * disagreeing about which way is older.
 */

import type { GeologicalStage } from "../../domain/index.js";

export type StageDirection = "older" | "younger";

/**
 * The stage one step from `selected` in `direction`, or `undefined` at the end
 * of the range — which the callers render as a disabled control with a stated
 * reason rather than a hidden one (charter §7).
 */
export function neighbourStage(
  stages: readonly GeologicalStage[],
  selected: string,
  direction: StageDirection,
): GeologicalStage | undefined {
  const index = stages.findIndex((s) => s.name === selected);
  if (index === -1) return undefined;
  const next = direction === "older" ? index - 1 : index + 1;
  return next >= 0 && next < stages.length ? stages[next] : undefined;
}
