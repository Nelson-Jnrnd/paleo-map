/**
 * Grouping units for the exploration view (SPEC-010). Pure, framework-light and
 * unit-testable without React or the map canvas: every function is an in-memory
 * fold over the loaded occurrences (NFR-001), no I/O.
 *
 * The Explorer picks a **mode** — occurrence (per record), locality (per
 * collection), or taxon (per taxonomic name) — and, in taxon mode, a **rank
 * tier** to roll records up to (Genus / Family / Major group). A taxon is a
 * *distribution*, so taxon mode never collapses the map points; it only changes
 * the list/selection/focus unit (SPEC-010 REQ-004). A locality, by contrast, has
 * one real paleocoordinate, so its records legitimately collapse to one marker at
 * the collection's own point (REQ-003) — never an averaged/fabricated position.
 */

import type {
  PaleogeographicPosition,
  ReadOccurrence,
  ReadTaxon,
} from "../../domain/index.js";

export type GroupingMode = "occurrence" | "locality" | "taxon";

/** The public-legible rank ladder inside taxon mode (SPEC-010 REQ-005). */
export type RankTier = "genus" | "family" | "majorGroup";

export const RANK_TIERS: readonly RankTier[] = ["genus", "family", "majorGroup"];

/** Domain labels for the tiers — domain language, legible as text (charter §2). */
export const RANK_TIER_LABEL: Readonly<Record<RankTier, string>> = {
  genus: "Genus",
  family: "Family",
  majorGroup: "Major group",
};

export const DEFAULT_RANK_TIER: RankTier = "genus";

/**
 * The curated set of dinosaur clades that read as an intuitive "major group"
 * (SPEC-010 REQ-005). Below Family, dinosaur clades do not follow a single
 * Linnaean rank, so the Major-group tier is resolved by name against this set
 * rather than by a rank — the intermediate `Clade` nodes in the chain (suborders,
 * superfamilies, unranked clades) are inert links, not selectable groups.
 */
export const MAJOR_GROUP_NAMES: ReadonlySet<string> = new Set([
  "Theropoda",
  "Coelurosauria",
  "Tyrannosauroidea",
  "Ornithomimosauria",
  "Sauropodomorpha",
  "Sauropoda",
  "Titanosauria",
  "Ornithischia",
  "Saurischia",
  "Thyreophora",
  "Ankylosauria",
  "Stegosauria",
  "Ornithopoda",
  "Hadrosauroidea",
  "Marginocephalia",
  "Ceratopsia",
  "Pachycephalosauria",
]);

/** Stable key for the bucket of records that don't classify at the chosen tier. */
export const NOT_CLASSIFIED_KEY = "__not_classified__";

/** Does a taxon sit at the requested tier? */
function matchesTier(taxon: ReadTaxon, tier: RankTier): boolean {
  switch (tier) {
    case "genus":
      return taxon.rank === "Genus";
    case "family":
      return taxon.rank === "Family";
    case "majorGroup":
      return taxon.rank === "Clade" && MAJOR_GROUP_NAMES.has(taxon.scientificName);
  }
}

/**
 * Resolve an occurrence's identified taxon **up its parent chain** to the nearest
 * ancestor (or itself) at the requested tier (SPEC-010 REQ-005 / DATA-002).
 * Returns null when no ancestor qualifies — the record is above the tier (e.g. a
 * "Theropoda indet." record asked to group by Genus) or its taxon/chain is not in
 * the snapshot — and the caller buckets it as "not classified". Cycle-guarded so a
 * malformed chain can never loop.
 */
export function resolveTierTaxon(
  taxonId: string,
  tier: RankTier,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): ReadTaxon | null {
  const seen = new Set<string>();
  let current = taxaById.get(taxonId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (matchesTier(current, tier)) return current;
    current = current.parentId ? (taxaById.get(current.parentId) ?? null) : null;
  }
  return null;
}

/** A locality: all in-view occurrences sharing a collection (SPEC-010 REQ-003). */
export interface LocalityGroup {
  collectionId: string;
  name: string;
  formation: string | null;
  /** The collection's own reconstructed paleocoordinate (never averaged). */
  paleo: PaleogeographicPosition | null;
  occurrenceIds: string[];
  /** Distinct taxa recorded at this locality. */
  taxonIds: string[];
  taxonCount: number;
  minMa: number | null;
  maxMa: number | null;
}

/** A taxon group at the chosen tier (SPEC-010 REQ-004/005). */
export interface TaxonGroup {
  /** Group key: the rolled-up taxon id, or NOT_CLASSIFIED_KEY. */
  key: string;
  /** The rolled-up taxon id (null for the not-classified bucket). */
  taxonId: string | null;
  name: string;
  occurrenceIds: string[];
  count: number;
  minMa: number | null;
  maxMa: number | null;
  notClassified: boolean;
}

interface MaSpan {
  minMa: number | null;
  maxMa: number | null;
}

/** Fold an occurrence's time range into a running Ma span. */
function extendSpan(span: MaSpan, o: ReadOccurrence): void {
  const range = o.timeRange.value;
  if (!range) return;
  span.minMa = span.minMa === null ? range.minMa : Math.min(span.minMa, range.minMa);
  span.maxMa = span.maxMa === null ? range.maxMa : Math.max(span.maxMa, range.maxMa);
}

/**
 * Group occurrences by their collection into localities (SPEC-010 REQ-003).
 * Deterministic: sorted by collection id so the list and any derived features are
 * byte-stable.
 */
export function groupByLocality(
  occurrences: readonly ReadOccurrence[],
): LocalityGroup[] {
  const byId = new Map<string, LocalityGroup>();
  for (const o of occurrences) {
    let group = byId.get(o.collectionId);
    if (!group) {
      group = {
        collectionId: o.collectionId,
        name: o.collectionName,
        formation: o.formation,
        paleo: o.paleoPosition.value,
        occurrenceIds: [],
        taxonIds: [],
        taxonCount: 0,
        minMa: null,
        maxMa: null,
      };
      byId.set(o.collectionId, group);
    }
    group.occurrenceIds.push(o.id);
    if (!group.taxonIds.includes(o.taxonId)) group.taxonIds.push(o.taxonId);
    extendSpan(group, o);
  }
  const groups = [...byId.values()];
  for (const g of groups) g.taxonCount = g.taxonIds.length;
  return groups.sort((a, b) =>
    a.collectionId < b.collectionId ? -1 : a.collectionId > b.collectionId ? 1 : 0,
  );
}

/**
 * Group occurrences by taxon, rolled up to the chosen tier (SPEC-010 REQ-004/005).
 * Records that do not classify at the tier collect in a single trailing
 * "not classified" bucket. Deterministic: classified groups sorted by name, the
 * not-classified bucket always last.
 */
export function groupByTaxon(
  occurrences: readonly ReadOccurrence[],
  tier: RankTier,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): TaxonGroup[] {
  const byKey = new Map<string, TaxonGroup>();
  for (const o of occurrences) {
    const resolved = resolveTierTaxon(o.taxonId, tier, taxaById);
    const key = resolved ? resolved.id : NOT_CLASSIFIED_KEY;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        taxonId: resolved ? resolved.id : null,
        name: resolved ? resolved.scientificName : notClassifiedLabel(tier),
        occurrenceIds: [],
        count: 0,
        minMa: null,
        maxMa: null,
        notClassified: resolved === null,
      };
      byKey.set(key, group);
    }
    group.occurrenceIds.push(o.id);
    extendSpan(group, o);
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.count = g.occurrenceIds.length;
  return groups.sort((a, b) => {
    if (a.notClassified !== b.notClassified) return a.notClassified ? 1 : -1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

/** The disclosed label for the not-classified bucket at a given tier. */
export function notClassifiedLabel(tier: RankTier): string {
  return `Not classified at ${RANK_TIER_LABEL[tier].toLowerCase()} level`;
}

/** Index a taxa array by id for the resolver (built once per reference load). */
export function indexTaxaById(
  taxa: readonly ReadTaxon[],
): ReadonlyMap<string, ReadTaxon> {
  return new Map(taxa.map((t) => [t.id, t]));
}
