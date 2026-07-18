/**
 * Display formatting helpers (charter §4/§6). Ma values use tabular mono in the
 * UI; here we only produce the strings. Ranges read older → younger with the Ma
 * unit; missing values are rendered by callers as the explicit "Not available"
 * label, never here as a blank default.
 */

import type { GeologicalStage, TimeRange } from "../domain/index.js";

export const NOT_AVAILABLE = "Not available";

/** e.g. { minMa: 66.5, maxMa: 68 } → "68–66.5 Ma" (older → younger). */
export function formatMaRange(range: TimeRange | null | undefined): string {
  if (!range) return NOT_AVAILABLE;
  // String() already drops a trailing ".0" (66.0 → "66") and keeps real
  // decimals (72.1 → "72.1").
  return `${String(range.maxMa)}–${String(range.minMa)} Ma`;
}

/** A single stage's span, e.g. "72.1–66 Ma". */
export function formatStageSpan(stage: GeologicalStage): string {
  return `${String(stage.startMa)}–${String(stage.endMa)} Ma`;
}
