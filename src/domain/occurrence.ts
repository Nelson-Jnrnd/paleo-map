/**
 * Occurrences, collections & geography (SPEC-001 design §6). Geography and time
 * belong to the *collection* (a locality); an occurrence is a taxon identified
 * in a collection per a reference — what PBDB actually models. `reconstructed`
 * is inherent to a paleocoordinate (produced by a rotation model); `approximate`
 * follows from the time-range stage span (DATA-003).
 */

export interface ModernPosition {
  lat: number;
  lng: number;
  region: string;
}

export interface PaleogeographicPosition {
  palaeoLat: number;
  palaeoLng: number;
  /** Which reconstruction produced it — makes `reconstructed` structural. */
  rotationModel: string;
  /**
   * The age (Ma) this position was reconstructed at (SPEC-016 DATA-001). When the
   * frame-consistent reconstruction is applied it is the displayed frame's age —
   * the same age as the coastline the point is drawn over — so a dot registers to
   * its coastline. Absent on positions taken verbatim from the source at the
   * collection's own age (pre-SPEC-016 / unreconstructed fallback).
   */
  reconstructionAgeMa?: number;
}

export interface TimeRange {
  /** Younger bound, smaller Ma. */
  minMa: number;
  /** Older bound, larger Ma. */
  maxMa: number;
}

export interface Collection {
  id: string;
  name: string;
  formation: string | null;
  member: string | null;
  modern: ModernPosition;
  /** null when PBDB has no paleocoordinate for the locality. */
  paleo: PaleogeographicPosition | null;
  timeRange: TimeRange;
  /** The citing reference source (PrimaryLiterature) — DATA-001/004. */
  sourceId: string;
}

export interface Identification {
  taxonId: string;
  taxonAsRecorded: string;
  reidentified: boolean;
  sourceId: string;
}

export interface FossilOccurrence {
  /** PBDB occurrence id. */
  id: string;
  collectionId: string;
  identifications: Identification[];
}
