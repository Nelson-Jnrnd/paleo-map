/**
 * Taxonomy & validity (SPEC-001 DATA-002, design §5). `ValidityStatus` is not
 * an attribute of a taxon; it is *derived* from the set of taxonomic opinions,
 * each asserted by a reference at a date — mirroring how PBDB computes accepted
 * names. The winning opinion and its citation are what the UI shows.
 */

export type TaxonomicRank = 'Clade' | 'Family' | 'Genus' | 'Species';

export type NomenclaturalStatus =
  | 'Valid'
  | 'Doubtful'
  | 'Synonymous'
  | 'Invalid'
  | 'Uncertain';

export interface TaxonName {
  name: string;
  isAccepted: boolean;
}

export interface TaxonomicOpinion {
  status: NomenclaturalStatus;
  /** ISO 8601 date the opinion was published. */
  publishedOn: string;
  sourceId: string;
}

export interface Taxon {
  id: string;
  scientificName: string;
  rank: TaxonomicRank;
  /** PBDB parent taxon id, if any (design §5, `parent of`). */
  parentId?: string;
}

export interface AcceptedOpinion {
  status: NomenclaturalStatus;
  opinion: TaxonomicOpinion;
}

/**
 * The winning taxonomic opinion (L2 derivation): the most recently published
 * opinion wins; ties are broken deterministically by `sourceId` so a rebuild is
 * byte-stable (NFR-001). Changing the winning opinion changes accepted status
 * (DATA-002 acceptance criterion).
 */
export function acceptedOpinion(
  opinions: readonly TaxonomicOpinion[],
): AcceptedOpinion | null {
  if (opinions.length === 0) return null;
  const winner = [...opinions].sort((a, b) => {
    if (a.publishedOn !== b.publishedOn) {
      return a.publishedOn < b.publishedOn ? 1 : -1;
    }
    return a.sourceId < b.sourceId ? 1 : -1;
  })[0]!;
  return { status: winner.status, opinion: winner };
}
