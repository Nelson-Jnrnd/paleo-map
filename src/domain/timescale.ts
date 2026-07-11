/**
 * Geological time (SPEC-001 design §7). A fixed ICS reference table, not sourced
 * per row. This is the minimal subset the MVP time window (Late Cretaceous)
 * needs; the `approximate` flag depends on stage spanning (DATA-003).
 */

export interface GeologicalStage {
  name: string;
  /** Older bound, larger Ma. */
  startMa: number;
  /** Younger bound, smaller Ma. */
  endMa: number;
  period: string;
  /** ICS period colour (meaning-only status colour, design charter). */
  periodColour: string;
}

/**
 * Late Cretaceous stages relevant to the Dinosauria MVP window. ICS 2023 ages;
 * Cretaceous ICS colour `#7fc64e`.
 */
export const LATE_CRETACEOUS_STAGES: readonly GeologicalStage[] = [
  { name: 'Santonian', startMa: 86.3, endMa: 83.6, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Campanian', startMa: 83.6, endMa: 72.1, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Maastrichtian', startMa: 72.1, endMa: 66.0, period: 'Cretaceous', periodColour: '#7fc64e' },
];

/** Stages a [minMa, maxMa] range overlaps (half-open interval overlap). */
export function stagesInRange(
  minMa: number,
  maxMa: number,
  stages: readonly GeologicalStage[] = LATE_CRETACEOUS_STAGES,
): GeologicalStage[] {
  return stages.filter(
    (s) => Math.max(minMa, s.endMa) < Math.min(maxMa, s.startMa),
  );
}

/**
 * Whether a time range spans more than one geologic stage — the structural
 * basis for the derived `approximate` flag (DATA-003, FONC-1140, CONS-210).
 */
export function spansMultipleStages(
  minMa: number,
  maxMa: number,
  stages: readonly GeologicalStage[] = LATE_CRETACEOUS_STAGES,
): boolean {
  return stagesInRange(minMa, maxMa, stages).length > 1;
}
