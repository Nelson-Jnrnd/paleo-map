/**
 * Provenance & the assertion pattern (SPEC-001 DATA-001/002/003, design §4).
 *
 * Three ideas are encoded structurally here:
 *  - every displayable value resolves to a `Source` or is explicitly `Editorial`;
 *  - judgments (validity, biology) are `Assertion`s made *by a source, at a date*;
 *  - the four uncertainty flags are a `«derived»` `ProvenanceView`, never stored.
 */

/** Typed provenance chain (design §2, §4). */
export type SourceKind =
  | 'PrimaryLiterature'
  | 'Database'
  | 'Encyclopedic'
  | 'Editorial';

/** Confidence is only ever *stated* by a source — we never invent it (CONS-080/410). */
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface Source {
  id: string;
  kind: SourceKind;
  /** Human-readable citation, e.g. "Osborn 1905" or "Paleobiology Database". */
  reference: string;
  url?: string;
  /** Snapshot retrieval date (ISO 8601). */
  retrievedOn: string;
  /** The source this one derives from — models the typed chain (design §4). */
  derivedFrom?: string;
}

/** A claim about something: `predicate = value`, made by a source at a date. */
export interface Assertion<T = string> {
  predicate: string;
  value: T;
  /** ISO 8601 date the claim was asserted/published. */
  assertedOn: string;
  sourceId: string;
  confidence?: ConfidenceLevel;
}

/**
 * The derived display flags (design §4). Computed from structure, so they cannot
 * drift from the data (DATA-003, SPEC-007 AMEND). Never persisted as editable
 * fields. SPEC-007 retired the `reconstructed` and `interpretative` flags; the
 * two that carry independent signal remain.
 */
export interface ProvenanceView {
  /** the time range spans more than one geologic stage / has wide bounds. */
  approximate: boolean;
  /** the value is null. */
  missing: boolean;
}

/**
 * A displayable value paired with its provenance. Per DATA-001, a non-null
 * displayable value is only valid if it resolves to a `Source` *or* is marked
 * `editorial`. This is the structural provenance invariant.
 */
export interface Provenanced<T> {
  value: T | null;
  /** Must resolve to a `Source` unless `editorial` is true. */
  sourceId: string | null;
  editorial: boolean;
  provenance: ProvenanceView;
}

/** missing flag: a null/undefined value — design §4. */
export function isMissing(value: unknown): boolean {
  return value === null || value === undefined;
}

export interface ProvenanceInput {
  value: unknown;
  /** true when the value's time range spans multiple stages / wide bounds. */
  approximate?: boolean;
}

/**
 * Derive the display flags from structure (DATA-003, SPEC-007). `approximate` is
 * supplied by the caller from the time-range span; `missing` is computed here
 * from the value itself.
 */
export function deriveProvenanceView(input: ProvenanceInput): ProvenanceView {
  return {
    approximate: input.approximate ?? false,
    missing: isMissing(input.value),
  };
}
