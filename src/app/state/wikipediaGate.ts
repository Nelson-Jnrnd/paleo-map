/**
 * Wikipedia gate (SPEC-014 AMEND-005). Central predicates for the "only taxa with
 * a Wikipedia article" behaviour, so the map filter, the panels, the greyed
 * "Open profile" affordance, and the breadcrumb all agree.
 *
 * Two distinct rules:
 *  - **Navigable / has a taxon page:** any taxon (genus, clade, family) whose
 *    `wikipedia` is set. Used by the breadcrumb and the "Open profile" button.
 *  - **Visible on the map by default:** an occurrence is shown only when it is
 *    tied to a **Wikipedia-documented genus** — its taxon resolves, is rank
 *    `Genus`, and has an article. Indeterminate occurrences (clade/family-tied,
 *    or unresolved) are hidden by default.
 */

import type { ReadOccurrence, ReadTaxon } from "../../domain/index.js";

/** True when this taxon has a Wikipedia article (so it has a navigable page). */
export function hasWikipedia(taxon: ReadTaxon | undefined): boolean {
  return Boolean(taxon?.wikipedia);
}

/** True when an occurrence is tied to a Wikipedia-documented genus (AMEND-005). */
export function isDocumentedGenusOccurrence(
  occurrence: ReadOccurrence,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): boolean {
  const taxon = taxaById.get(occurrence.taxonId);
  return taxon?.rank === "Genus" && Boolean(taxon.wikipedia);
}

/**
 * Apply the default-hide gate to an occurrence set. When `showAll` is true the
 * set is returned unchanged (the "show all" toggle); otherwise only occurrences
 * tied to a Wikipedia-documented genus survive.
 */
export function gateOccurrences(
  occurrences: readonly ReadOccurrence[],
  taxaById: ReadonlyMap<string, ReadTaxon>,
  showAll: boolean,
): ReadOccurrence[] {
  if (showAll) return occurrences as ReadOccurrence[];
  return occurrences.filter((o) => isDocumentedGenusOccurrence(o, taxaById));
}
