/**
 * SPEC-014 AMEND-005 — the Wikipedia gate. By default only occurrences tied to a
 * Wikipedia-documented genus are shown; toggling "show all" reveals article-less
 * and indeterminate (clade/family-tied) occurrences. Ancestor/greyed navigability
 * keys off `hasWikipedia` for any rank.
 */

import { expect, test } from "vitest";
import type { ReadOccurrence, ReadTaxon } from "../../src/domain/index.js";
import {
  gateOccurrences,
  hasWikipedia,
  isDocumentedGenusOccurrence,
} from "../../src/app/state/wikipediaGate.js";

function taxon(id: string, rank: string, hasArticle: boolean): ReadTaxon {
  return {
    id,
    rank,
    scientificName: id,
    wikipedia: hasArticle
      ? { title: id, url: `https://en.wikipedia.org/wiki/${id}` }
      : null,
  } as unknown as ReadTaxon;
}

function occ(id: string, taxonId: string): ReadOccurrence {
  return { id, taxonId, taxonName: taxonId } as unknown as ReadOccurrence;
}

const TAXA = new Map<string, ReadTaxon>([
  ["g-doc", taxon("g-doc", "Genus", true)], // documented genus → visible
  ["g-none", taxon("g-none", "Genus", false)], // genus, no article → hidden
  ["clade-doc", taxon("clade-doc", "Clade", true)], // indeterminate → hidden
]);

const OCCS = [
  occ("o1", "g-doc"),
  occ("o2", "g-none"),
  occ("o3", "clade-doc"),
  occ("o4", "missing-taxon"), // unresolved → hidden
];

test("hasWikipedia is true for any rank with an article, false otherwise", () => {
  expect(hasWikipedia(TAXA.get("clade-doc"))).toBe(true);
  expect(hasWikipedia(TAXA.get("g-none"))).toBe(false);
  expect(hasWikipedia(undefined)).toBe(false);
});

test("only a documented-genus occurrence passes the strict predicate", () => {
  expect(isDocumentedGenusOccurrence(occ("o1", "g-doc"), TAXA)).toBe(true);
  expect(isDocumentedGenusOccurrence(occ("o3", "clade-doc"), TAXA)).toBe(false);
  expect(isDocumentedGenusOccurrence(occ("o2", "g-none"), TAXA)).toBe(false);
});

test("default gate hides article-less and indeterminate occurrences", () => {
  const gated = gateOccurrences(OCCS, TAXA, false).map((o) => o.id);
  expect(gated).toEqual(["o1"]);
});

test("show-all reveals every occurrence unchanged", () => {
  const shown = gateOccurrences(OCCS, TAXA, true).map((o) => o.id);
  expect(shown).toEqual(["o1", "o2", "o3", "o4"]);
});
