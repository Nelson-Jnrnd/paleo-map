/**
 * Fetch + simplify the paleogeographic basemap (SPEC-004, AMEND-001). Pulls REAL
 * reconstructed Late-Cretaceous coastlines from the GPlates Web Service using the
 * PALEOMAP (Scotese) model — the same plate frame as the occurrences'
 * paleocoordinates (SPEC-001 pins `pgm=scotese`) — so land and points align
 * (REQ-002). The result is Douglas–Peucker-simplified and coordinate-rounded to
 * meet the payload budget (NFR-001), then written to `public/basemap/` and
 * committed, so the app build and CI stay offline and reproducible.
 *
 * Run manually to refresh the committed data:  pnpm run fetch:basemap
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const TARGET_AGE_MA = 70; // representative single reconstruction for the MVP window
const MODEL = 'paleomap'; // Scotese PALEOMAP — matches PBDB pgm=scotese
const SOURCE_URL = `https://gws.gplates.org/reconstruct/coastlines/?time=${TARGET_AGE_MA}&model=${MODEL}`;
const SIMPLIFY_TOLERANCE = 0.3; // degrees
const COORD_DECIMALS = 2;

type Pt = [number, number];

function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = dx * dx + dy * dy;
  if (denom === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  let index = 0;
  let max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max > tol) {
    const left = douglasPeucker(pts.slice(0, index + 1), tol);
    const right = douglasPeucker(pts.slice(index), tol);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0]!, pts[pts.length - 1]!];
}

function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i]![0] * ring[i + 1]![1] - ring[i + 1]![0] * ring[i]![1];
  }
  return Math.abs(a / 2);
}

function round(ring: Pt[]): Pt[] {
  const f = 10 ** COORD_DECIMALS;
  return ring.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]);
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: { geometry: { type: string; coordinates: Pt[][] } }[];
}

async function main(): Promise<void> {
  console.log(`Fetching coastlines: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`GPlates fetch failed (${res.status} ${res.statusText})`);
  const raw = (await res.json()) as FeatureCollection;

  const features = [];
  for (const f of raw.features) {
    if (f.geometry.type !== 'Polygon') continue;
    const outer = f.geometry.coordinates[0];
    if (!outer) continue;
    if (ringArea(outer) < SIMPLIFY_TOLERANCE * SIMPLIFY_TOLERANCE) continue; // drop specks
    const simplified = round(douglasPeucker(outer, SIMPLIFY_TOLERANCE));
    if (simplified.length < 4) continue;
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [simplified] },
    });
  }

  const geojson = { type: 'FeatureCollection', features };
  const meta = {
    name: `Late Cretaceous coastlines (${TARGET_AGE_MA} Ma)`,
    source: 'GPlates Web Service (gws.gplates.org), PALEOMAP model',
    sourceUrl: SOURCE_URL,
    // PALEOMAP is Scotese's model — the frame PBDB uses for pgm=scotese — so this
    // matches the snapshot's rotationModel and land/points align (REQ-002).
    rotationModel: 'scotese',
    model: MODEL,
    targetAgeMa: TARGET_AGE_MA,
    licence: 'CC BY 4.0 — EarthByte / GPlates (Scotese PALEOMAP coastlines)',
    note: `Single ${TARGET_AGE_MA} Ma reconstruction, representative for the Campanian–Maastrichtian window.`,
  };

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(repoRoot, 'public', 'basemap');
  await mkdir(outDir, { recursive: true });
  const body = JSON.stringify(geojson) + '\n';
  await writeFile(join(outDir, 'late-cretaceous.geojson'), body, 'utf-8');
  await writeFile(join(outDir, 'late-cretaceous.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  console.log(
    `Wrote ${features.length} coastline polygons ` +
      `(${(body.length / 1024).toFixed(0)} KB raw, ${(gzipSync(body).length / 1024).toFixed(0)} KB gzipped) → ${outDir}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
