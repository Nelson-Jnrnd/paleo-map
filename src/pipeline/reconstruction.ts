/**
 * Frame-consistent occurrence reconstruction (SPEC-016 REQ-001, DATA-001). A
 * fossil's paleocoordinate must be reconstructed at the **same age as the
 * coastline frame it is drawn over** (the stage midpoint) for the dot to register
 * to that coastline. PBDB gives one paleocoordinate per collection at the
 * collection's own age, so the same locality drawn over two stage frames drifts
 * by the age gap between them.
 *
 * This module holds the pure, offline application of a committed **reconstruction
 * cache** — a map from (modern lng, lat, frame age) to the reconstructed
 * paleocoordinate at that age. The cache is produced at build/refresh time by
 * `scripts/reconstruct_occurrences.ts` (GPlates `/reconstruct/reconstruct_points`,
 * PALEOMAP/Scotese — the same model and service as the coastlines). Applying it
 * here stays network-free and deterministic (SPEC-016 NFR-001, SEC-001): the
 * cache is the only input, and an occurrence with no cache entry keeps its
 * original position (documented fallback, never a silent guess).
 */

import { deriveProvenanceView } from '../domain/index.js';
import type { ReadOccurrence } from '../domain/index.js';

/**
 * A committed reconstruction cache: `key(lng, lat, ageMa)` → `[palaeoLng,
 * palaeoLat]`. Keyed on the modern coordinate + the target age so one entry
 * serves every occurrence at that locality and age.
 */
export type ReconstructionCache = Record<string, [number, number]>;

/** Decimals the key rounds modern coordinates to (≈1 m; matches PBDB precision). */
const COORD_KEY_DECIMALS = 4;
/** Decimals the key rounds the target age to (frame ages are given to 0.1 Ma). */
const AGE_KEY_DECIMALS = 1;

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Stable cache key for a (modern lng, lat, target age). Rounding keeps the key
 * identical whether it is written by the fetch script or looked up by the build,
 * so a warm cache is always a hit (NFR-002).
 */
export function reconstructionKey(lng: number, lat: number, ageMa: number): string {
  const x = roundTo(lng, COORD_KEY_DECIMALS);
  const y = roundTo(lat, COORD_KEY_DECIMALS);
  const t = roundTo(ageMa, AGE_KEY_DECIMALS);
  return `${x},${y}@${t}`;
}

/**
 * Reconstruct a stage's occurrences to `targetAgeMa` using the cache (SPEC-016
 * REQ-001). Pure: returns a new array; each occurrence whose modern position is
 * present and whose (lng, lat, age) is in the cache gets a new `paleoPosition`
 * at the frame age (value + `reconstructionAgeMa`, provenance recomputed).
 * Occurrences without a modern position or a cache entry are returned unchanged —
 * the fallback keeps the source's collection-age position rather than inventing
 * one. `targetAgeMa` is the frame age (the coastline's age) for the stage.
 */
export function applyFrameReconstruction(
  occurrences: readonly ReadOccurrence[],
  targetAgeMa: number,
  cache: ReconstructionCache,
): ReadOccurrence[] {
  return occurrences.map((o) => {
    const modern = o.modernPosition.value;
    const paleo = o.paleoPosition.value;
    if (!modern) return o; // unplaceable — nothing to reconstruct from
    const hit = cache[reconstructionKey(modern.lng, modern.lat, targetAgeMa)];
    if (!hit) return o; // documented fallback: keep the source position
    const [palaeoLng, palaeoLat] = hit;
    const value = {
      palaeoLat,
      palaeoLng,
      // Preserve the pinned model; record the age this value was reconstructed at.
      // The cache is built with PALEOMAP/Scotese, so that is the model even when
      // the source had no prior paleocoordinate to copy the label from.
      rotationModel: paleo?.rotationModel ?? 'scotese',
      reconstructionAgeMa: targetAgeMa,
    };
    return {
      ...o,
      paleoPosition: {
        ...o.paleoPosition,
        value,
        provenance: deriveProvenanceView({ value }),
      },
    };
  });
}
