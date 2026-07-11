/**
 * Source-client contract for the ingestion pipeline (SPEC-001 §9, SPEC-002
 * REQ-007). The pipeline consumes raw records through this interface; the tested
 * path uses a fixture client bundling a small Dinosauria subset (offline,
 * deterministic). A live HTTP adapter (PBDB REST + Wikidata SPARQL) is a drop-in
 * for the same interface — it is not exercised here because the environment's
 * network policy denies those hosts, matching the "no live calls at request
 * time" model (DATA-005).
 *
 * The raw shapes below are the *subset of fields the pipeline consumes*, named
 * after their PBDB/Wikidata origins — not the full upstream vocabularies.
 */

import type { SnapshotMetadata } from '../domain/index.js';

/** A PBDB primary-literature reference. */
export interface RawPbdbReference {
  id: string;
  reference: string;
  url?: string;
  pubYear: number;
}

export interface RawPbdbTaxon {
  id: string;
  name: string;
  rank: 'Clade' | 'Family' | 'Genus' | 'Species';
  parentId?: string;
}

export interface RawPbdbOpinion {
  taxonId: string;
  status: 'Valid' | 'Doubtful' | 'Synonymous' | 'Invalid' | 'Uncertain';
  publishedOn: string;
  referenceId: string;
}

export interface RawPbdbCollection {
  id: string;
  name: string;
  formation: string | null;
  member: string | null;
  lat: number;
  lng: number;
  region: string;
  /** Paleocoordinates as returned by PBDB (may be absent). */
  palaeoLat: number | null;
  palaeoLng: number | null;
  maxMa: number;
  minMa: number;
  referenceId: string;
}

export interface RawPbdbOccurrence {
  id: string;
  collectionId: string;
  taxonId: string;
  taxonAsRecorded: string;
  reidentified: boolean;
  referenceId: string;
}

export interface RawPbdbMeasurement {
  taxonId: string;
  kind: 'BodyLength' | 'BodyMass';
  value: number | null;
  unit: string;
  lowerBound: number | null;
  upperBound: number | null;
  referenceId: string;
  publishedOn: string;
}

/** A Wikidata binding: the join key from a PBDB taxon to encyclopedic content. */
export interface RawWikidataBinding {
  qid: string;
  pbdbTaxonId: string;
  enwikiTitle: string;
  enwikiUrl: string;
  commonName?: string;
}

/** A Wikipedia article summary snapshot (CC BY-SA), keyed by Wikidata QID. */
export interface RawWikipediaSummary {
  qid: string;
  extract: string;
  url: string;
}

/**
 * Where a biology attribute's value comes from — lets one attribute be primary
 * (a PBDB reference), tertiary (a Wikipedia article via QID), or editorial. The
 * source kind decides whether the UI marks the value interpretative (DATA-003).
 */
export type RawSourceRef =
  | { via: 'reference'; referenceId: string }
  | { via: 'encyclopedic'; qid: string }
  | { via: 'editorial' };

export interface RawBiologyAttribute {
  taxonId: string;
  kind: 'Diet' | 'Locomotion' | 'Habitat';
  value: string;
  assertedOn: string;
  source: RawSourceRef;
}

/** A Commons image reference + its licence, as captured in the encyclopedic step. */
export interface RawImageAsset {
  taxonId: string;
  type: 'FossilPhoto' | 'SkeletalMount' | 'ArtisticReconstruction' | 'Silhouette';
  credit: string | null;
  licence: string | null;
  sourceUrl: string;
}

/** An editorial (L3) featured write-up, hand-authored and attributed. */
export interface RawEditorialEntry {
  taxonId: string;
  text: string;
  /** The encyclopedic article this synthesis draws on, if any (design §4 chain). */
  derivedFromUrl?: string;
}

export interface SourceSubset {
  metadata: SnapshotMetadata;
  references: RawPbdbReference[];
  taxa: RawPbdbTaxon[];
  opinions: RawPbdbOpinion[];
  collections: RawPbdbCollection[];
  occurrences: RawPbdbOccurrence[];
  measurements: RawPbdbMeasurement[];
  attributes: RawBiologyAttribute[];
  wikidata: RawWikidataBinding[];
  wikipedia: RawWikipediaSummary[];
  images: RawImageAsset[];
  editorial: RawEditorialEntry[];
}

export interface SourceClient {
  fetchSubset(): Promise<SourceSubset>;
}
