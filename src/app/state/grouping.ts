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

export const RANK_TIERS: readonly RankTier[] = [
  "genus",
  "family",
  "majorGroup",
];

/** Domain labels for the tiers — domain language, legible as text (charter §2). */
export const RANK_TIER_LABEL: Readonly<Record<RankTier, string>> = {
  genus: "Genus",
  family: "Family",
  majorGroup: "Major group",
};

export const DEFAULT_RANK_TIER: RankTier = "genus";

/**
 * The list's row unit (SPEC-026 API-001). One flat set replacing the mode +
 * rank pair in the *view*: mode and rank were two controls answering one
 * question — "what is a row?" — and the third mode secretly spawned a dropdown.
 *
 * `mode` and `rank` stay in state unchanged, so every existing consumer
 * (`OccurrenceMap`'s `mode` prop, `groupByTaxon(occurrences, rank, …)`) keeps its
 * contract; these two total mappings are the only bridge.
 */
export type ListUnit =
  | "occurrence"
  | "locality"
  | "genus"
  | "family"
  | "majorGroup";

export const LIST_UNITS: readonly ListUnit[] = [
  "occurrence",
  "locality",
  "genus",
  "family",
  "majorGroup",
];

export const LIST_UNIT_LABEL: Readonly<Record<ListUnit, string>> = {
  occurrence: "Occurrence",
  locality: "Locality",
  genus: "Genus",
  family: "Family",
  majorGroup: "Major group",
};

/** The unit a (mode, rank) pair represents. Total. */
export function unitOf(mode: GroupingMode, rank: RankTier): ListUnit {
  if (mode === "occurrence") return "occurrence";
  if (mode === "locality") return "locality";
  return rank;
}

/** The (mode, rank) pair a unit represents. Total; rank is preserved for the
 *  non-taxon units so returning to a taxon unit keeps the tier it had. */
export function modeAndRankOf(
  unit: ListUnit,
  currentRank: RankTier = DEFAULT_RANK_TIER,
): { mode: GroupingMode; rank: RankTier } {
  if (unit === "occurrence") return { mode: "occurrence", rank: currentRank };
  if (unit === "locality") return { mode: "locality", rank: currentRank };
  return { mode: "taxon", rank: unit };
}

/** True for the three taxonomic units, which REQ-004 filters. */
export function isTaxonUnit(unit: ListUnit): boolean {
  return unit === "genus" || unit === "family" || unit === "majorGroup";
}

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

/** Does a taxon sit at the requested tier? */
function matchesTier(taxon: ReadTaxon, tier: RankTier): boolean {
  switch (tier) {
    case "genus":
      return taxon.rank === "Genus";
    case "family":
      return taxon.rank === "Family";
    case "majorGroup":
      return (
        taxon.rank === "Clade" && MAJOR_GROUP_NAMES.has(taxon.scientificName)
      );
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
    current = current.parentId
      ? (taxaById.get(current.parentId) ?? null)
      : null;
  }
  return null;
}

/** A locality: all in-view occurrences sharing a collection (SPEC-010 REQ-003). */
export interface LocalityGroup {
  collectionId: string;
  name: string;
  formation: string | null;
  /**
   * Present-day region as the snapshot records it — "Wyoming, US",
   * "Omnogov, MN": a sub-national area plus an ISO-2 country code, rendered
   * verbatim (SPEC-026 REQ-002). Null when the snapshot has none.
   */
  region: string | null;
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
  /** Group key — always a real taxon id since SPEC-026 REQ-004. */
  key: string;
  taxonId: string;
  name: string;
  occurrenceIds: string[];
  count: number;
  minMa: number | null;
  maxMa: number | null;
}

interface MaSpan {
  minMa: number | null;
  maxMa: number | null;
}

/** Fold an occurrence's time range into a running Ma span. */
function extendSpan(span: MaSpan, o: ReadOccurrence): void {
  const range = o.timeRange.value;
  if (!range) return;
  span.minMa =
    span.minMa === null ? range.minMa : Math.min(span.minMa, range.minMa);
  span.maxMa =
    span.maxMa === null ? range.maxMa : Math.max(span.maxMa, range.maxMa);
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
        region: o.modernPosition.value?.region ?? null,
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
  // SPEC-026 REQ-005: with a 300-row render cap, the order decides what is *not*
  // shown — so it is the busiest localities, not an arbitrary id order.
  return groups.sort(
    (a, b) =>
      b.taxonCount - a.taxonCount ||
      compareText(a.name, b.name) ||
      compareText(a.collectionId, b.collectionId),
  );
}

/** Locale-independent, so the order is identical wherever the test runs. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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
    // SPEC-026 REQ-004 (owner instruction, 2026-08-14): a record that does not
    // classify at this tier is not a row here. It is not dropped from the atlas
    // — it is listed, counted, mapped and openable under the Occurrence and
    // Locality units — but at a taxon unit it has no taxon to be a row for.
    if (!resolved) continue;
    const key = resolved.id;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        taxonId: resolved.id,
        name: resolved.scientificName,
        occurrenceIds: [],
        count: 0,
        minMa: null,
        maxMa: null,
      };
      byKey.set(key, group);
    }
    group.occurrenceIds.push(o.id);
    extendSpan(group, o);
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.count = g.occurrenceIds.length;
  // REQ-005: busiest first, then name, then id — fully deterministic, because
  // the render cap makes the order decide what is not shown.
  return groups.sort(
    (a, b) =>
      b.count - a.count ||
      compareText(a.name, b.name) ||
      compareText(a.key, b.key),
  );
}

/**
 * REQ-004: the predicate the taxon units filter their occurrence set by, applied
 * once so the list, the count and the map all derive from the same records — a
 * point on the map always has a row behind it.
 */
export function classifiesAt(
  occurrence: ReadOccurrence,
  tier: RankTier,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): boolean {
  return resolveTierTaxon(occurrence.taxonId, tier, taxaById) !== null;
}

/** Index a taxa array by id for the resolver (built once per reference load). */
export function indexTaxaById(
  taxa: readonly ReadTaxon[],
): ReadonlyMap<string, ReadTaxon> {
  return new Map(taxa.map((t) => [t.id, t]));
}
