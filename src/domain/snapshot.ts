/**
 * The dated snapshot read model (SPEC-001 DATA-005, NFR-001). This is the
 * serialized L2+L3 artifact the atlas app reads from our own store — it never
 * calls PBDB/Wikipedia at request time. Every displayable field is `Provenanced`
 * (DATA-001); the snapshot carries a `retrievedOn` date and the pinned rotation
 * model (AMEND-001) so paleocoordinates stay attributable and reproducible.
 */

import type { Provenanced, Source } from "./provenance.js";
import type { NomenclaturalStatus, TaxonomicRank } from "./taxonomy.js";
import type {
  ModernPosition,
  PaleogeographicPosition,
  TimeRange,
} from "./occurrence.js";
import type {
  AttributeKind,
  ContentLevel,
  ImageType,
  MeasurementKind,
} from "./profile.js";
import type { EnrichmentRecord } from "./enrichment.js";

export interface SnapshotMetadata {
  /** Immutable import date (ISO 8601) — surfaced in the UI (FONC-1170). */
  retrievedOn: string;
  /** Pinned plate-rotation model for paleocoordinates (AMEND-001). */
  rotationModel: string;
  rotationModelVersion: string;
  /** Human description of the PBDB subset captured. */
  pbdbSubset: string;
  timeWindow: { name: string; maxMa: number; minMa: number };
  /**
   * Provenance for `ReadProfile.popularity` (SPEC-020 DATA-001), carried once
   * here rather than repeated on every profile: the value is identical for all
   * of them, and duplicating it ~985 times would cost more than the numbers do
   * (SPEC-020 AMEND-001). Absent when no popularity cache was applied.
   */
  popularity?: PopularityProvenance;
}

/**
 * Where a popularity figure came from and what it counts (SPEC-020 DATA-001).
 * It is an assertion about **human attention** in a stated window, sourced and
 * dated — never a property of the animal, and never rendered as one (UX-001).
 */
export interface PopularityProvenance {
  /** The measured window, e.g. "2025-08/2026-08". */
  window: string;
  /** ISO date the counts were fetched. */
  retrievedOn: string;
  /** Resolves to a `Source` in the model's source table. */
  sourceId: string;
}

/**
 * A resolved Wikipedia article for a taxon (SPEC-014 AMEND-005). Resolved once at
 * build time against the MediaWiki API (existence + canonical title, redirects
 * followed) and committed, so runtime stays offline (DATA-005). The taxon page
 * embeds `url`; `null` on the taxon means "no article" — it is hidden by default
 * and never navigable.
 */
export interface WikipediaRef {
  /** Canonical article title (redirects resolved), e.g. "Tyrannosaurus". */
  title: string;
  /** Full article URL used by the inline profile iframe. */
  url: string;
}

export interface ReadTaxon {
  id: string;
  scientificName: string;
  rank: TaxonomicRank;
  /**
   * PBDB parent taxon id, if any (SPEC-010 DATA-002). Exposes the taxonomic
   * parent chain so Taxon mode can roll an occurrence up to a chosen rank
   * (Genus / Family / Major group). Absent for the tree's root.
   */
  parentId?: string;
  /** Derived winning validity, shown with its citation (DATA-002). */
  validity: Provenanced<NomenclaturalStatus>;
  /** "per <source reference>" — the opinion/reference that won. */
  acceptedPer: string | null;
  /**
   * Resolved Wikipedia article (SPEC-014 AMEND-005), or `null` when the taxon has
   * no article. Build-time resolved and committed; the inline taxon page embeds
   * it. Optional in the type so pre-AMEND-005 fixtures/snapshots stay valid — a
   * missing field is treated as `null` (no article).
   */
  wikipedia?: WikipediaRef | null;
}

export interface ReadOccurrence {
  id: string;
  taxonId: string;
  taxonName: string;
  /**
   * Stable id of the collection (locality) the occurrence belongs to (SPEC-010
   * DATA-001). Occurrences sharing it are the same place, so Locality mode groups
   * on this — not on the non-unique display `collectionName`.
   */
  collectionId: string;
  collectionName: string;
  formation: string | null;
  member: string | null;
  modernPosition: Provenanced<ModernPosition>;
  paleoPosition: Provenanced<PaleogeographicPosition>;
  timeRange: Provenanced<TimeRange>;
}

export interface ReadMeasurement {
  kind: MeasurementKind;
  unit: string;
  lowerBound: number | null;
  upperBound: number | null;
  value: Provenanced<number>;
}

export interface ReadAttribute {
  kind: AttributeKind;
  value: Provenanced<string>;
}

export interface ReadImage {
  type: ImageType;
  credit: string;
  licence: string;
  /** Directly renderable image (bundled or Commons thumbnail) — SPEC-012 REQ-001. */
  imageUrl: string;
  /** Commons file *description page* — the human-facing attribution link. */
  sourceUrl: string;
  sourceId: string;
}

export interface ReadProfile {
  taxonId: string;
  contentLevel: ContentLevel;
  /** Encyclopedic/editorial summary; null when unmatched (explicit not-available). */
  summary: Provenanced<string> | null;
  commonName: Provenanced<string> | null;
  attributes: ReadAttribute[];
  measurements: ReadMeasurement[];
  /** Only images whose licence is honoured with a credit (DATA-007). */
  images: ReadImage[];
  /**
   * AI-assisted enrichment distilled from the taxon's Wikipedia article
   * (SPEC-014 REQ-001), or null when no cached record covers this taxon. Content
   * only — extract-don't-invent; the source article + revid live in the build
   * cache, and the page discloses the AI assistance once (NFR-002).
   */
  enrichment: EnrichmentRecord | null;
  /**
   * Local path to the taxon's bundled PhyloPic silhouette (SPEC-014 REQ-004),
   * resolved by name with a phylogenetic fallback to the nearest relative, or
   * null when nothing resolved (the UI then uses a generic clade silhouette).
   */
  silhouette: string | null;
  /**
   * Total occurrences of this taxon across the whole snapshot (SPEC-008
   * AMEND-001). Precomputed so a stage-partitioned profile reports the taxon's
   * full record, not just the currently-loaded stage.
   */
  occurrenceCount: number;
  /**
   * Total English Wikipedia pageviews over the window named in
   * `SnapshotMetadata.popularity` (SPEC-020 DATA-001), or `null` when the
   * article did not resolve or the fetch failed. **Null is never a zero**: it
   * says we do not know, and such a taxon is simply left out of the well-known
   * track rather than ranked last.
   *
   * An assertion about how often people looked the article up — not about
   * scientific importance, and never displayed as a fact about the animal.
   *
   * Optional rather than required so the **absent** case costs nothing in the
   * shipped artifact: writing `"popularity":null` onto all 2,555 profiles cost
   * 45 KB, against 19 KB for the ~950 figures that actually exist (measured
   * 2026-08-11). A missing key and an explicit null mean the same thing here —
   * not established — and neither is ever read as a zero.
   */
  popularity?: number | null;
  /** Aggregate time span across all the taxon's occurrences; null if undatable. */
  timeSpan: TimeRange | null;
  /** True when any constituent occurrence's date is approximate (DATA-003). */
  timeSpanApproximate: boolean;
}

/** The complete L2+L3 read model — the static data-artifact contract. */
export interface ReadModel {
  metadata: SnapshotMetadata;
  /** Resolvable source table (id → Source). */
  sources: Record<string, Source>;
  taxa: ReadTaxon[];
  occurrences: ReadOccurrence[];
  profiles: ReadProfile[];
  /**
   * Derived index: taxon id → sorted country codes of its occurrences
   * (SPEC-028 DATA-001). Optional because it is joined at boot from its own
   * artifact rather than carried in `reference.json`, and because a model built
   * in memory (tests, fixtures) legitimately has none — consumers read it
   * through `ReadApi.countriesFor`, which answers `[]` when it is absent.
   *
   * It lives here rather than beside `occurrences` because it is a *whole
   * snapshot* aggregate: the occurrences in the model at any moment are one
   * stage's, and the countries of a genus are not.
   */
  countriesByTaxon?: Readonly<Record<string, readonly string[]>>;
}
