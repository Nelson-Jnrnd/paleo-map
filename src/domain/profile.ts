/**
 * Taxon profile & media (SPEC-001 DATA-006/007, design §8). Biology is a set of
 * typed, nullable, sourced attributes/measurements — sparse by design. Numeric
 * estimates carry bounds and a source; `ContentLevel` is derived from how many
 * fields are populated; images carry licence + credit or are not shown.
 */

import type { Assertion } from './provenance.js';

export type AttributeKind = 'Diet' | 'Locomotion' | 'Habitat';
export type MeasurementKind = 'BodyLength' | 'BodyMass';
export type ImageType =
  | 'FossilPhoto'
  | 'SkeletalMount'
  | 'ArtisticReconstruction'
  | 'Silhouette';

/** Completeness ladder (FONC-430…470). Derived, never hand-set. */
export type ContentLevel =
  | 'OccurrenceOnly'
  | 'ShortProfile'
  | 'DetailedProfile'
  | 'FeaturedSpecies';

export interface BiologyAttribute {
  kind: AttributeKind;
  assertion: Assertion<string>;
}

export interface Measurement {
  kind: MeasurementKind;
  value: number | null;
  unit: string;
  /** Uncertainty comes from the source; never invented (CONS-080/410). */
  lowerBound: number | null;
  upperBound: number | null;
  assertion: Assertion<number | null>;
}

export interface ImageAsset {
  type: ImageType;
  credit: string | null;
  licence: string | null;
  /** Directly renderable image (a bundled or Commons thumbnail) — SPEC-012 REQ-001. */
  imageUrl: string;
  /** Commons file *description page* — the human-facing attribution link. */
  sourceUrl: string;
  sourceId: string;
}

export interface EditorialSummary {
  text: string;
  sourceId: string;
}

/** An image is only shown if its licence can be honoured with a credit (DATA-007). */
export function isShowable(img: ImageAsset): boolean {
  return Boolean(img.licence) && Boolean(img.credit);
}

export interface ProfileContent {
  hasSummary: boolean;
  attributeCount: number;
  measurementCount: number;
  imageCount: number;
  /** Editorial featured-species designation (L3). */
  featured: boolean;
}

/**
 * Derive the content level from how many structured fields are populated
 * (design §8). Deterministic (NFR-001).
 */
export function deriveContentLevel(c: ProfileContent): ContentLevel {
  const populated =
    c.attributeCount +
    c.measurementCount +
    (c.hasSummary ? 1 : 0) +
    (c.imageCount > 0 ? 1 : 0);
  if (populated === 0) return 'OccurrenceOnly';
  if (c.featured && c.hasSummary && c.imageCount > 0) return 'FeaturedSpecies';
  if (populated >= 4) return 'DetailedProfile';
  return 'ShortProfile';
}
