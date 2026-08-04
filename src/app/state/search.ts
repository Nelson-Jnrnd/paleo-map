/**
 * Taxon search (SPEC-013). Pure, in-memory name matching over the loaded read
 * model — no fetch (DATA-005). Matches a query against each taxon's scientific
 * and common name, ranks prefix matches above mid-string ones, then breaks ties
 * by notability (the derived `contentLevel`) so well-known taxa surface above
 * obscure genera, then alphabetically. Deterministic (NFR-001).
 */

import type { ContentLevel, ReadTaxon, TimeRange } from "../../domain/index.js";
import { tierOfTaxon } from "./grouping.js";
import type { RankTier } from "./grouping.js";

export interface SearchableTaxon {
  taxonId: string;
  scientificName: string;
  commonName: string | null;
  contentLevel: ContentLevel;
}

export interface SearchResult {
  taxonId: string;
  scientificName: string;
  commonName: string | null;
}

/** Minimum query length before matching (REQ-002) and result cap (REQ-002). */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 8;

/** Notability weight from the completeness ladder (REQ-003). */
const NOTABILITY: Readonly<Record<ContentLevel, number>> = {
  FeaturedSpecies: 3,
  DetailedProfile: 2,
  ShortProfile: 1,
  OccurrenceOnly: 0,
};

/**
 * Rank taxa for a query. Prefix matches (quality 2) rank above substring matches
 * (quality 1); ties break by notability then scientific name. Returns at most
 * `limit` results; an empty/too-short query returns nothing.
 */
export function searchTaxa(
  query: string,
  index: readonly SearchableTaxon[],
  limit: number = SEARCH_RESULT_LIMIT,
  minChars: number = SEARCH_MIN_CHARS,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < minChars) return [];

  const scored: Array<{ t: SearchableTaxon; quality: number }> = [];
  for (const t of index) {
    const sci = t.scientificName.toLowerCase();
    const com = t.commonName?.toLowerCase() ?? "";
    let quality = -1;
    if (sci.startsWith(q) || (com && com.startsWith(q))) quality = 2;
    else if (sci.includes(q) || (com && com.includes(q))) quality = 1;
    if (quality >= 0) scored.push({ t, quality });
  }

  scored.sort(
    (a, b) =>
      b.quality - a.quality ||
      NOTABILITY[b.t.contentLevel] - NOTABILITY[a.t.contentLevel] ||
      a.t.scientificName.localeCompare(b.t.scientificName),
  );

  return scored.slice(0, limit).map(({ t }) => ({
    taxonId: t.taxonId,
    scientificName: t.scientificName,
    commonName: t.commonName,
  }));
}

/**
 * Where a search result lands in Taxon mode (SPEC-013 REQ-004, SPEC-017 REQ-004):
 * the tier to group at and the group key to select.
 */
export interface TaxonLanding {
  /** The group key to select — always a key `groupByTaxon` can produce. */
  taxonKey: string;
  /** The tier to group at: the one at which `taxonKey` is itself a group. */
  rank: RankTier;
  /** The landed taxon's name (what the panel will show). */
  landedName: string;
  /**
   * The searched taxon's name when it is *not* the landed one — i.e. the search
   * had to substitute an ancestor, which the panel must disclose. Null when the
   * Explorer landed on exactly what they searched for.
   */
  substitutedFrom: string | null;
}

/**
 * Resolve a searched taxon to a group the map/list can actually produce
 * (SPEC-017 REQ-004).
 *
 * Rank alone is not enough: `groupByTaxon`'s Major-group tier only ever keys on
 * the curated `MAJOR_GROUP_NAMES`, so 268 of the snapshot's 285 clades can never
 * be a group key. Landing on such a taxon used to select a key no group could
 * match — mode, rank and stage all changed and nothing was selected.
 *
 * So we walk the taxon's **real ancestry** (DATA-002) and land on the *nearest*
 * ancestor that is tier-eligible — itself, if it qualifies — reporting the
 * substitution so the panel can disclose it (HD-001). Returns null when no
 * ancestor qualifies, which the caller turns into a designed explanatory state
 * rather than a silent no-op. Cycle-guarded; pure and deterministic.
 */
export function landingForTaxon(
  taxonId: string,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): TaxonLanding | null {
  const searched = taxaById.get(taxonId);
  if (!searched) return null;

  const seen = new Set<string>();
  let current: ReadTaxon | null = searched;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const tier = tierOfTaxon(current);
    if (tier) {
      return {
        taxonKey: current.id,
        rank: tier,
        landedName: current.scientificName,
        substitutedFrom:
          current.id === searched.id ? null : searched.scientificName,
      };
    }
    current = current.parentId
      ? (taxaById.get(current.parentId) ?? null)
      : null;
  }
  return null;
}

/** A stage as needed to place a taxon on the timeline (older bound = larger Ma). */
export interface StageBound {
  name: string;
  startMa: number;
  endMa: number;
}

function overlaps(a: TimeRange, startMa: number, endMa: number): boolean {
  return Math.max(endMa, a.minMa) < Math.min(startMa, a.maxMa);
}

/**
 * Choose the stage to show a searched taxon at (SPEC-013 REQ-004 age-independence):
 * keep the current stage if the taxon already overlaps it; otherwise pick the
 * stage with the greatest overlap with the taxon's recorded span; fall back to the
 * current stage when the span is unknown or nothing overlaps. Pure/deterministic.
 */
export function stageForTaxon(
  span: TimeRange | null,
  currentStageName: string,
  stages: readonly StageBound[],
): string {
  if (!span) return currentStageName;
  const current = stages.find((s) => s.name === currentStageName);
  if (current && overlaps(span, current.startMa, current.endMa)) {
    return currentStageName;
  }
  let best: { name: string; overlap: number } | null = null;
  for (const s of stages) {
    const overlap =
      Math.min(s.startMa, span.maxMa) - Math.max(s.endMa, span.minMa);
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { name: s.name, overlap };
    }
  }
  return best?.name ?? currentStageName;
}
