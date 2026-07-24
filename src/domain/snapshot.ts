/**
 * The dated snapshot read model (SPEC-001 DATA-005, NFR-001). This is the
 * serialized L2+L3 artifact the atlas app reads from our own store — it never
 * calls PBDB/Wikipedia at request time. Every displayable field is `Provenanced`
 * (DATA-001); the snapshot carries a `retrievedOn` date and the pinned rotation
 * model (AMEND-001) so paleocoordinates stay attributable and reproducible.
 */

import type { Provenanced, Source } from './provenance.js';
import type { NomenclaturalStatus, TaxonomicRank } from './taxonomy.js';
import type {
  ModernPosition,
  PaleogeographicPosition,
  TimeRange,
} from './occurrence.js';
import type {
  AttributeKind,
  ContentLevel,
  ImageType,
  MeasurementKind,
} from './profile.js';

export interface SnapshotMetadata {
  /** Immutable import date (ISO 8601) — surfaced in the UI (FONC-1170). */
  retrievedOn: string;
  /** Pinned plate-rotation model for paleocoordinates (AMEND-001). */
  rotationModel: string;
  rotationModelVersion: string;
  /** Human description of the PBDB subset captured. */
  pbdbSubset: string;
  timeWindow: { name: string; maxMa: number; minMa: number };
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
   * Total occurrences of this taxon across the whole snapshot (SPEC-008
   * AMEND-001). Precomputed so a stage-partitioned profile reports the taxon's
   * full record, not just the currently-loaded stage.
   */
  occurrenceCount: number;
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
}
