/**
 * Taxonomic lineage derivation (SPEC-014 REQ-006). Walks the `parentId` chain
 * already in the read model — no new data source — from a taxon up to its root,
 * returning the ancestors ordered root → … → the taxon itself. Pure and cycle-
 * safe: a missing parent simply ends the chain (graceful degradation), and a
 * cyclic or overlong chain is capped so malformed data can't loop forever.
 */

import type { ReadTaxon } from "../../domain/index.js";

const MAX_DEPTH = 40;

export function taxonLineage(
  taxonId: string,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): ReadTaxon[] {
  const chain: ReadTaxon[] = [];
  const seen = new Set<string>();
  let current = taxaById.get(taxonId);
  while (current && !seen.has(current.id) && chain.length < MAX_DEPTH) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? taxaById.get(current.parentId) : undefined;
  }
  // Built leaf → root; reverse so callers read root → … → taxon.
  return chain.reverse();
}
