/**
 * Geological time (SPEC-001 design §7; SPEC-008 REQ-002). A fixed ICS reference
 * table, not sourced per row. SPEC-008 widens it from the Late-Cretaceous MVP
 * subset to the **full ICS Mesozoic** stage list (Induan → Maastrichtian) so the
 * timeline can step the whole 252–66 Ma window and the `approximate` flag
 * (DATA-003) is evaluated against every stage, not just three.
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

/** ICS period colours (meaning-only status colours, charter §4). */
export const PERIOD_COLOURS: Readonly<Record<string, string>> = {
  Triassic: '#812b92',
  Jurassic: '#34b2c9',
  Cretaceous: '#7fc64e',
};

/**
 * The complete ICS Mesozoic stage table, oldest → youngest (deep-time reads
 * left → right). Boundary ages follow the ICS International Chronostratigraphic
 * Chart (v2023/09). 30 stages: Triassic (7), Jurassic (11), Cretaceous (12).
 */
export const MESOZOIC_STAGES: readonly GeologicalStage[] = [
  // --- Triassic ---
  { name: 'Induan', startMa: 251.902, endMa: 251.2, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Olenekian', startMa: 251.2, endMa: 247.2, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Anisian', startMa: 247.2, endMa: 242.0, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Ladinian', startMa: 242.0, endMa: 237.0, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Carnian', startMa: 237.0, endMa: 227.0, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Norian', startMa: 227.0, endMa: 208.5, period: 'Triassic', periodColour: '#812b92' },
  { name: 'Rhaetian', startMa: 208.5, endMa: 201.4, period: 'Triassic', periodColour: '#812b92' },
  // --- Jurassic ---
  { name: 'Hettangian', startMa: 201.4, endMa: 199.5, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Sinemurian', startMa: 199.5, endMa: 192.9, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Pliensbachian', startMa: 192.9, endMa: 184.2, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Toarcian', startMa: 184.2, endMa: 174.7, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Aalenian', startMa: 174.7, endMa: 170.9, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Bajocian', startMa: 170.9, endMa: 168.2, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Bathonian', startMa: 168.2, endMa: 165.3, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Callovian', startMa: 165.3, endMa: 161.5, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Oxfordian', startMa: 161.5, endMa: 154.8, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Kimmeridgian', startMa: 154.8, endMa: 149.2, period: 'Jurassic', periodColour: '#34b2c9' },
  { name: 'Tithonian', startMa: 149.2, endMa: 145.0, period: 'Jurassic', periodColour: '#34b2c9' },
  // --- Cretaceous ---
  { name: 'Berriasian', startMa: 145.0, endMa: 139.8, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Valanginian', startMa: 139.8, endMa: 132.6, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Hauterivian', startMa: 132.6, endMa: 129.4, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Barremian', startMa: 129.4, endMa: 121.4, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Aptian', startMa: 121.4, endMa: 113.0, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Albian', startMa: 113.0, endMa: 100.5, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Cenomanian', startMa: 100.5, endMa: 93.9, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Turonian', startMa: 93.9, endMa: 89.8, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Coniacian', startMa: 89.8, endMa: 86.3, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Santonian', startMa: 86.3, endMa: 83.6, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Campanian', startMa: 83.6, endMa: 72.1, period: 'Cretaceous', periodColour: '#7fc64e' },
  { name: 'Maastrichtian', startMa: 72.1, endMa: 66.0, period: 'Cretaceous', periodColour: '#7fc64e' },
];

/**
 * Late Cretaceous subset retained for the SPEC-008 rollback path and any caller
 * that still needs the original MVP window (SPEC-008 "Rollback plan").
 */
export const LATE_CRETACEOUS_STAGES: readonly GeologicalStage[] =
  MESOZOIC_STAGES.filter((s) => ['Santonian', 'Campanian', 'Maastrichtian'].includes(s.name));

/** The three Mesozoic periods, oldest → youngest (FONC-100). */
export const MESOZOIC_PERIODS: readonly string[] = ['Triassic', 'Jurassic', 'Cretaceous'];

/** URL/file-safe slug for a stage name, e.g. "Maastrichtian" → "maastrichtian". */
export function stageSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** The stages that belong to a period, in table order. */
export function stagesInPeriod(
  period: string,
  stages: readonly GeologicalStage[] = MESOZOIC_STAGES,
): GeologicalStage[] {
  return stages.filter((s) => s.period === period);
}

/** The midpoint age (Ma) of a stage — the target age its basemap frame uses. */
export function stageMidpointMa(stage: GeologicalStage): number {
  return Math.round(((stage.startMa + stage.endMa) / 2) * 10) / 10;
}

/** Stages a [minMa, maxMa] range overlaps (half-open interval overlap). */
export function stagesInRange(
  minMa: number,
  maxMa: number,
  stages: readonly GeologicalStage[] = MESOZOIC_STAGES,
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
  stages: readonly GeologicalStage[] = MESOZOIC_STAGES,
): boolean {
  return stagesInRange(minMa, maxMa, stages).length > 1;
}
