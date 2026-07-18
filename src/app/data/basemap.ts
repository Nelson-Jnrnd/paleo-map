/**
 * Paleogeographic basemap loading + frame reconciliation (SPEC-004 REQ-002/003/
 * 004). Loads static schematic geometry and its metadata; compares the geometry's
 * rotation model to the occurrences' pinned model and produces an explicit
 * disclosure when they differ (never hides the mismatch — charter §2). Pure,
 * network-free helpers so the reconciliation is unit-testable without a map.
 */

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
