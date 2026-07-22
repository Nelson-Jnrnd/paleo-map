/**
 * Viewport filtering for the on-screen occurrence list (SPEC-009 REQ-003; NFR-001).
 * Pure, in-memory, O(n) — no I/O. The list mirrors the map's points, so an
 * occurrence with no reconstructed paleoposition is not placeable and is therefore
 * not in the viewport list (recorded assumption, SPEC-009 Edge cases). When no
 * bounds are known (no WebGL / map not yet loaded) the caller passes `null` and the
 * full set is returned — the accessible fallback (REQ-003).
 */

import type { ReadOccurrence } from "../../domain/index.js";

/** Map bounds in degrees, as reported by MapLibre's `getBounds()`. */
export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Whether a lng/lat point lies within the bounds. Longitude may wrap the
 * antimeridian (west > east), in which case the in-range test is the union of the
 * two half-open arcs (SPEC-009 Edge cases).
 */
export function withinBounds(
  lng: number,
  lat: number,
  bounds: Bounds,
): boolean {
  const inLat = lat >= bounds.south && lat <= bounds.north;
  const inLng =
    bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east;
  return inLat && inLng;
}

/**
 * The occurrences currently on screen. The list mirrors the map's points, so an
 * occurrence with no reconstructed paleoposition is **never** listed (SPEC-009
 * REQ-003, owner decision 2026-07-22). With `null` bounds (no viewport signal) the
 * fallback lists every *placeable* occurrence; with bounds it further narrows to
 * those inside the viewport.
 */
export function occurrencesInView(
  occurrences: readonly ReadOccurrence[],
  bounds: Bounds | null,
): ReadOccurrence[] {
  return occurrences.filter((o) => {
    const paleo = o.paleoPosition.value;
    if (paleo == null) return false;
    return (
      bounds == null || withinBounds(paleo.palaeoLng, paleo.palaeoLat, bounds)
    );
  });
}
