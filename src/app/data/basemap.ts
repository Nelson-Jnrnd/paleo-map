/**
 * Paleogeographic basemap loading + frame reconciliation (SPEC-004 REQ-002/003/
 * 004; SPEC-008 REQ-004). Loads static reconstructed geometry and its metadata;
 * compares the geometry's rotation model to the occurrences' pinned model and
 * produces an explicit disclosure when they differ (never hides the mismatch —
 * charter §2). SPEC-008 makes the frame **time-varying**: a set of per-stage
 * frames is described by a basemap index, and `selectFrame` resolves the selected
 * stage to its frame or the nearest available one. Pure, network-free helpers so
 * frame selection and reconciliation are unit-testable without a map.
 */

import { MESOZOIC_STAGES, stageMidpointMa } from "../../domain/index.js";

export interface BasemapMeta {
  name: string;
  source: string;
  sourceUrl?: string;
  rotationModel: string;
  model?: string;
  targetAgeMa: number;
  licence: string;
  note: string;
}

export interface Basemap {
  meta: BasemapMeta;
  geojson: GeoJSON.FeatureCollection;
}

export const BASEMAP_GEOJSON_URL = "basemap/late-cretaceous.geojson";
export const BASEMAP_META_URL = "basemap/late-cretaceous.meta.json";

/** One reconstructed frame available to the client (SPEC-008 REQ-004). */
export interface FrameDescriptor {
  stage: string;
  slug: string;
  targetAgeMa: number;
  geojsonUrl: string;
  metaUrl: string;
}

/** The set of per-stage frames, described by `public/basemap/index.json`. */
export interface BasemapFrameIndex {
  model: string;
  rotationModel: string;
  licence: string;
  frames: FrameDescriptor[];
  /**
   * The present-day (0 Ma) frame (SPEC-029 DATA-001). A sibling of `frames`,
   * never a member: `selectFrame` resolves a stage to the nearest frame **by
   * age**, and a 0 Ma entry in that list could only ever be a wrong answer.
   * Keeping it out makes that unreachable by construction.
   *
   * Optional so an index written before SPEC-029 still parses — the view then
   * withholds the frame toggle rather than failing (UX-002).
   */
  present?: PresentFrameDescriptor;
}

/** The present-day frame. It has no stage and no slug — there is only one. */
export interface PresentFrameDescriptor {
  targetAgeMa: 0;
  geojsonUrl: string;
  metaUrl: string;
}

export const BASEMAP_INDEX_URL = "basemap/index.json";

/**
 * Resolve the selected stage to a frame: the exact per-stage frame when present,
 * otherwise the frame whose target age is closest to the stage's midpoint (the
 * nearest-available-frame fallback — SPEC-008 REQ-004). Returns null when no
 * frame exists at all (→ the caller degrades to the graticule). `exact: false`
 * signals the UI to disclose that a neighbouring reconstruction is shown.
 */
export function selectFrame(
  stageName: string,
  frames: readonly FrameDescriptor[],
): { frame: FrameDescriptor; exact: boolean } | null {
  if (frames.length === 0) return null;
  const exact = frames.find((f) => f.stage === stageName);
  if (exact) return { frame: exact, exact: true };

  const target =
    MESOZOIC_STAGES.find((s) => s.name === stageName) !== undefined
      ? stageMidpointMa(MESOZOIC_STAGES.find((s) => s.name === stageName)!)
      : null;
  if (target === null) return { frame: frames[0]!, exact: false };

  let best = frames[0]!;
  let bestDelta = Math.abs(best.targetAgeMa - target);
  for (const f of frames) {
    const delta = Math.abs(f.targetAgeMa - target);
    if (delta < bestDelta) {
      best = f;
      bestDelta = delta;
    }
  }
  return { frame: best, exact: false };
}

/** Load the per-stage frame index. Resolves to null on any failure. */
export async function loadBasemapFrameIndex(
  url: string = BASEMAP_INDEX_URL,
): Promise<BasemapFrameIndex | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const index = (await res.json()) as BasemapFrameIndex;
    if (!Array.isArray(index.frames)) return null;
    return index;
  } catch {
    return null;
  }
}

/**
 * Frame reconciliation: does the basemap share the occurrences' rotation model?
 * When it does not, `note` is the disclosure the UI must show so points-on-coasts
 * are not read as precise (SPEC-004 REQ-002).
 */
export function describeFrame(
  basemap: BasemapMeta,
  occurrenceRotationModel: string,
): { matches: boolean; note: string } {
  const matches =
    basemap.rotationModel.toLowerCase() ===
    occurrenceRotationModel.toLowerCase();
  if (matches) {
    return {
      matches,
      note: `Coastlines and occurrences use the same reconstruction (${occurrenceRotationModel}).`,
    };
  }
  return {
    matches,
    note:
      `Schematic coastlines — they do not use the occurrences' ` +
      `${occurrenceRotationModel} reconstruction, so positions on land are indicative only.`,
  };
}

/**
 * Load the basemap. Resolves to null on any failure (missing/invalid geometry) so
 * the caller degrades gracefully to the ocean/graticule (SPEC-004 REQ-004).
 */
export async function loadBasemap(
  geojsonUrl: string = BASEMAP_GEOJSON_URL,
  metaUrl: string = BASEMAP_META_URL,
): Promise<Basemap | null> {
  try {
    const [gRes, mRes] = await Promise.all([fetch(geojsonUrl), fetch(metaUrl)]);
    if (!gRes.ok || !mRes.ok) return null;
    const geojson = (await gRes.json()) as GeoJSON.FeatureCollection;
    const meta = (await mRes.json()) as BasemapMeta;
    if (
      geojson.type !== "FeatureCollection" ||
      !Array.isArray(geojson.features)
    )
      return null;
    return { meta, geojson };
  } catch {
    return null;
  }
}
