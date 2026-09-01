/**
 * Viewport filtering for the on-screen occurrence list (SPEC-009 REQ-003; NFR-001).
 * Pure, in-memory, O(n) — no I/O. The list mirrors the map's points, so an
 * occurrence with no reconstructed paleoposition is not placeable and is therefore
 * not in the viewport list (recorded assumption, SPEC-009 Edge cases). When no
 * bounds are known (no WebGL / map not yet loaded) the caller passes `null` and the
 * full set is returned — the accessible fallback (REQ-003).
 *
 * SPEC-027 REQ-003 adds the inverse direction: deriving a camera target from a
 * point set (`boundsOfPoints`) and deciding whether the camera needs to move at
 * all (`fractionInView`), so a search result can be framed. Same discipline —
 * pure, no map object, unit-testable.
 */

import type { ReadOccurrence } from "../../domain/index.js";
import { positionIn } from "./frame.js";
import type { FrameMode } from "./frame.js";

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
  mode: FrameMode = "paleo",
): ReadOccurrence[] {
  return occurrences.filter((o) => {
    const at = positionIn(o, mode);
    if (at == null) return false;
    return bounds == null || withinBounds(at.lng, at.lat, bounds);
  });
}

/** A projected point, as the map's camera helpers below consume them. */
export interface LngLat {
  lng: number;
  lat: number;
}

/**
 * The placeable positions of a set of occurrences, in the active frame
 * (SPEC-027 REQ-003; frame-aware since SPEC-029 REQ-003). Named for the frame
 * rather than for the paleo one it used to assume, because the camera must fit
 * the points it is actually about to draw.
 */
export function framePoints(
  occurrences: readonly ReadOccurrence[],
  mode: FrameMode = "paleo",
): LngLat[] {
  const points: LngLat[] = [];
  for (const o of occurrences) {
    const at = positionIn(o, mode);
    if (at) points.push(at);
  }
  return points;
}

/**
 * The **shorter** longitudinal arc containing every point. Taking plain
 * min/max would wrap the long way round for a taxon straddling the
 * antimeridian — a Pacific-rim distribution would frame the whole planet — so
 * instead we find the widest empty gap between consecutive longitudes (treating
 * the sequence as circular) and return its complement. `east` may exceed 180 to
 * keep the arc monotonic for the caller; `west` is always a real longitude.
 */
function shorterLngArc(lngs: readonly number[]): {
  west: number;
  east: number;
} {
  const sorted = [...lngs].sort((a, b) => a - b);
  const first = sorted[0] as number;
  let widestGap = -1;
  let gapStart = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const here = sorted[i] as number;
    const next =
      i === sorted.length - 1 ? first + 360 : (sorted[i + 1] as number);
    if (next - here > widestGap) {
      widestGap = next - here;
      gapStart = i;
    }
  }
  const west =
    gapStart === sorted.length - 1 ? first : (sorted[gapStart + 1] as number);
  const east = sorted[gapStart] as number;
  return { west, east: east < west ? east + 360 : east };
}

/**
 * Bounds enclosing a point set, or null when there is nothing to frame
 * (SPEC-027 REQ-003). A single point — or several at one place — yields a
 * zero-area box; the caller clamps the resulting zoom rather than diving to
 * maximum (SPEC-027 Edge cases).
 */
export function boundsOfPoints(points: readonly LngLat[]): Bounds | null {
  if (points.length === 0) return null;
  const { west, east } = shorterLngArc(points.map((p) => p.lng));
  let south = Infinity;
  let north = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return { west, south, east, north };
}

/**
 * The share of `points` already inside `bounds`, in [0, 1] (SPEC-027 REQ-003,
 * OQ-002). With no bounds yet (no viewport signal) nothing is considered framed,
 * so the caller frames it. An empty point set is vacuously fully in view — there
 * is nothing to move the camera for.
 */
export function fractionInView(
  points: readonly LngLat[],
  bounds: Bounds | null,
): number {
  if (points.length === 0) return 1;
  if (!bounds) return 0;
  const inside = points.filter((p) =>
    withinBounds(p.lng, p.lat, bounds),
  ).length;
  return inside / points.length;
}
