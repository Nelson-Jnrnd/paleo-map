/**
 * Generate the paleogeographic basemap asset (SPEC-004). Emits a *schematic*,
 * hand-approximated set of Late-Cretaceous landmasses as static GeoJSON plus a
 * metadata sidecar (source, model, target age, licence). It is deliberately
 * low-detail and is labeled "schematic" in the UI — it is NOT a plate-model
 * reconstruction and does NOT use the occurrences' Scotese/PALEOMAP frame, so the
 * app discloses that mismatch (SPEC-004 REQ-002). Swapping in real, frame-matched
 * geometry later is a one-file replacement of the outputs written here.
 *
 * Written to `public/basemap/` by `predev`/`prebuild`, served as static files.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Ring = [number, number][];

/** A simple closed rectangle ring in [lng, lat] (obviously schematic). */
function box(west: number, south: number, east: number, north: number): Ring {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

interface LandFeature {
  name: string;
  rings: Ring[];
}

// Rough Late-Cretaceous (~70 Ma) landmass blocks. The occurrence cluster sits at
// palaeo ~(-75 lng, 55 lat) in the Scotese frame; the "North America (Laramidia)"
// block spans that so points fall on land. Positions are indicative only.
const LAND: LandFeature[] = [
  { name: 'North America (Laramidia + Appalachia)', rings: [box(-125, 22, -55, 74)] },
  { name: 'South America', rings: [box(-82, -55, -34, 12)] },
  { name: 'Eurasia', rings: [box(-12, 30, 145, 78)] },
  { name: 'Africa', rings: [box(-16, -36, 52, 36)] },
  { name: 'India (drifting)', rings: [box(58, -32, 92, 6)] },
  { name: 'Australia–Antarctica', rings: [box(95, -72, 165, -18)] },
];

function featureCollection(): unknown {
  return {
    type: 'FeatureCollection',
    features: LAND.map((f) => ({
      type: 'Feature',
      properties: { name: f.name },
      geometry: { type: 'Polygon', coordinates: f.rings },
    })),
  };
}

const META = {
  name: 'Late Cretaceous (schematic)',
  source: 'Schematic, project-authored — hand-approximated landmasses',
  // Deliberately NOT "scotese": this is not a plate-model output. The app
  // compares this to the snapshot's rotationModel and discloses the mismatch.
  rotationModel: 'schematic',
  targetAgeMa: 70,
  licence: 'CC0-1.0 (schematic, authored for this project)',
  note: 'Indicative landmasses only — not a plate reconstruction; positions are approximate.',
};

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(repoRoot, 'public', 'basemap');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'late-cretaceous.geojson'),
    JSON.stringify(featureCollection()) + '\n',
    'utf-8',
  );
  await writeFile(
    join(outDir, 'late-cretaceous.meta.json'),
    JSON.stringify(META, null, 2) + '\n',
    'utf-8',
  );
  console.log(`Wrote schematic basemap (${LAND.length} landmasses) → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
