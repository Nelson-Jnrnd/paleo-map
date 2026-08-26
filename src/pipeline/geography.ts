/**
 * Per-taxon country index (SPEC-028 REQ-001, DATA-001). Pure folds over
 * occurrences, so the derivation is testable without files or a network — the
 * same shape as `silhouettes.ts` and `popularity.ts`, which also pair a pure
 * module here with a thin script under `scripts/`.
 *
 * Dinordle needs to know which present-day countries a genus's occurrences fall
 * in. The read model carries `modernPosition` per **occurrence**, and
 * occurrences are delivered per stage, so answering that from the shipped model
 * would mean loading all 30 stage files (29 MB). This index is folded once at build time
 * instead.
 */

import type { ReadOccurrence } from "../domain/index.js";

/** PBDB writes the region as "<state or province>, <CC>", or bare "<CC>". */
const COUNTRY_CODE = /^[A-Z]{2}$/;

export interface GeographyIndex {
  /** The snapshot's `retrievedOn`, so a stale index is detectable. */
  generatedFrom: string;
  /** Taxon id → sorted, de-duplicated country codes of its occurrences. */
  countriesByTaxon: Record<string, string[]>;
}

/**
 * The country code an occurrence's modern position states, or null.
 *
 * The code is taken **verbatim as PBDB states it** and is never normalised to
 * ISO — PBDB writes `UK` where ISO writes `GB`, and rewriting it here would make
 * the index assert something its source does not (SPEC-028 REQ-001). Anything
 * that is not exactly two capitals is dropped rather than repaired: the shipped
 * snapshot has two such occurrences (region tail `O2`) out of 41,116, and
 * guessing what they meant would be inventing data.
 */
export function countryOf(occurrence: ReadOccurrence): string | null {
  const region = occurrence.modernPosition.value?.region;
  if (!region) return null;
  const tail = region.split(",").pop()?.trim() ?? "";
  return COUNTRY_CODE.test(tail) ? tail : null;
}

/**
 * Fold occurrences into taxon → sorted unique country codes. Both the keys and
 * the values are sorted, so the artifact is byte-stable across runs and engines
 * (SPEC-001 NFR-001, SPEC-028 NFR-003).
 */
export function indexCountries(
  occurrences: Iterable<ReadOccurrence>,
): Record<string, string[]> {
  const byTaxon = new Map<string, Set<string>>();
  for (const o of occurrences) {
    const code = countryOf(o);
    if (!code) continue;
    const set = byTaxon.get(o.taxonId) ?? new Set<string>();
    set.add(code);
    byTaxon.set(o.taxonId, set);
  }
  const out: Record<string, string[]> = {};
  for (const taxonId of [...byTaxon.keys()].sort()) {
    out[taxonId] = [...byTaxon.get(taxonId)!].sort();
  }
  return out;
}
