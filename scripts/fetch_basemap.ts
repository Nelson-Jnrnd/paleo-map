/**
 * Fetch + simplify the per-stage paleogeographic basemap (SPEC-004, SPEC-008
 * REQ-004). Pulls REAL reconstructed coastlines from the GPlates Web Service
 * using the PALEOMAP (Scotese) model — the same plate frame as the occurrences'
 * paleocoordinates (SPEC-001 pins `pgm=scotese`) — one frame per ICS Mesozoic
 * stage at the stage's midpoint age, so land and points align at every step
 * (REQ-002/004). Each frame is Douglas–Peucker-simplified and coordinate-rounded
 * to meet the per-frame payload budget (NFR-002), then written to
 * `public/basemap/<slug>.geojson` with a `<slug>.meta.json`, plus an
 * `index.json` the app loads to select the frame for the selected stage. All
 * committed, so the app build and CI stay offline and reproducible.
 *
 * Run manually to refresh the committed data:  pnpm run fetch:basemap
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import {
  MESOZOIC_STAGES,
  stageMidpointMa,
  stageSlug,
} from "../src/domain/index.js";
import type { GeologicalStage } from "../src/domain/index.js";

const MODEL = "paleomap"; // Scotese PALEOMAP — matches PBDB pgm=scotese
const SIMPLIFY_TOLERANCE = 0.3; // degrees
const COORD_DECIMALS = 2;
const LICENCE = "CC BY 4.0 — EarthByte / GPlates (Scotese PALEOMAP coastlines)";

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
  type: "FeatureCollection";
  features: { geometry: { type: string; coordinates: Pt[][] } }[];
}

async function fetchJson(url: string, attempt = 1): Promise<FeatureCollection> {
  try {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`GPlates fetch failed (${res.status} ${res.statusText})`);
    return (await res.json()) as FeatureCollection;
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
    return fetchJson(url, attempt + 1);
  }
}

function simplify(raw: FeatureCollection): {
  type: "FeatureCollection";
  features: unknown[];
} {
  const features = [];
  for (const f of raw.features) {
    if (f.geometry.type !== "Polygon") continue;
    const outer = f.geometry.coordinates[0];
    if (!outer) continue;
    if (ringArea(outer) < SIMPLIFY_TOLERANCE * SIMPLIFY_TOLERANCE) continue; // drop specks
    const simplified = round(douglasPeucker(outer, SIMPLIFY_TOLERANCE));
    if (simplified.length < 4) continue;
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [simplified] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * The present-day frame (SPEC-029 REQ-001). Deliberately **not** a `FrameEntry`
 * and deliberately not in `frames`: `selectFrame` resolves a Mesozoic stage to
 * the nearest available frame by age, and a 0 Ma frame sitting in that list
 * could only ever be a wrong answer. Keeping it a separate field on the index
 * makes it unreachable by that path, by construction.
 */
interface PresentEntry {
  targetAgeMa: 0;
  geojsonUrl: string;
  metaUrl: string;
}

interface FrameEntry {
  stage: string;
  slug: string;
  targetAgeMa: number;
  geojsonUrl: string;
  metaUrl: string;
}

/**
 * Fetch, simplify and write the present-day (0 Ma) frame (SPEC-029 REQ-001).
 * Same service, same model, same simplification as every stage frame — so the
 * two frames a player toggles between are the same kind of object, drawn the
 * same way, and only the age differs.
 */
async function writePresentFrame(outDir: string): Promise<PresentEntry> {
  const url = `https://gws.gplates.org/reconstruct/coastlines/?time=0&model=${MODEL}`;
  const geojson = simplify(await fetchJson(url));
  const meta = {
    name: "Present-day coastlines (0 Ma)",
    source: "GPlates Web Service (gws.gplates.org), PALEOMAP model",
    sourceUrl: url,
    rotationModel: "scotese",
    model: MODEL,
    targetAgeMa: 0,
    licence: LICENCE,
    note:
      "Present-day coastlines. Occurrences drawn over this frame are their " +
      "recorded collection coordinates, not reconstructions (SPEC-029 REQ-005).",
  };
  const body = JSON.stringify(geojson) + "\n";
  await writeFile(join(outDir, "present.geojson"), body, "utf-8");
  await writeFile(
    join(outDir, "present.meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
    "utf-8",
  );
  console.log(
    `  present-day        0 Ma  ${geojson.features.length} polygons  ` +
      `${(gzipSync(body).length / 1024).toFixed(0)} KB gz`,
  );
  return {
    targetAgeMa: 0,
    geojsonUrl: "basemap/present.geojson",
    metaUrl: "basemap/present.meta.json",
  };
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = join(repoRoot, "public", "basemap");
  await mkdir(outDir, { recursive: true });

  // `--present-only` refreshes just the 0 Ma frame and leaves the 30 committed
  // stage frames untouched. Refetching all of them would rewrite committed data
  // for no reason, and each refetch is a live service call whose output can
  // drift — so the narrow path is the safe one.
  if (process.argv.includes("--present-only")) {
    const present = await writePresentFrame(outDir);
    const indexPath = join(outDir, "index.json");
    const existing = JSON.parse(await readFile(indexPath, "utf-8")) as Record<
      string,
      unknown
    >;
    await writeFile(
      indexPath,
      JSON.stringify({ ...existing, present }, null, 2) + "\n",
      "utf-8",
    );
    console.log(`Updated the present-day frame + index.json → ${outDir}`);
    return;
  }

  // Clear stale frames (old single-frame files + previous per-stage output).
  for (const name of await readdir(outDir).catch(() => [])) {
    if (name.endsWith(".geojson") || name.endsWith(".json")) {
      await rm(join(outDir, name));
    }
  }

  const frames: FrameEntry[] = [];
  let totalGz = 0;

  for (const stage of MESOZOIC_STAGES as readonly GeologicalStage[]) {
    const slug = stageSlug(stage.name);
    const targetAgeMa = stageMidpointMa(stage);
    const url = `https://gws.gplates.org/reconstruct/coastlines/?time=${targetAgeMa}&model=${MODEL}`;
    try {
      const raw = await fetchJson(url);
      const geojson = simplify(raw);
      const meta = {
        name: `${stage.name} coastlines (${targetAgeMa} Ma)`,
        source: "GPlates Web Service (gws.gplates.org), PALEOMAP model",
        sourceUrl: url,
        // PALEOMAP is Scotese's model — the frame PBDB uses for pgm=scotese — so
        // this matches the snapshot's rotationModel and land/points align (REQ-002).
        rotationModel: "scotese",
        model: MODEL,
        targetAgeMa,
        licence: LICENCE,
        note: `Reconstruction at ${targetAgeMa} Ma (midpoint of the ${stage.name} stage).`,
      };
      const body = JSON.stringify(geojson) + "\n";
      await writeFile(join(outDir, `${slug}.geojson`), body, "utf-8");
      await writeFile(
        join(outDir, `${slug}.meta.json`),
        JSON.stringify(meta, null, 2) + "\n",
        "utf-8",
      );
      const gz = gzipSync(body).length;
      totalGz += gz;
      frames.push({
        stage: stage.name,
        slug,
        targetAgeMa,
        geojsonUrl: `basemap/${slug}.geojson`,
        metaUrl: `basemap/${slug}.meta.json`,
      });
      console.log(
        `  ${stage.name.padEnd(14)} ${String(targetAgeMa).padStart(6)} Ma  ` +
          `${geojson.features.length} polygons  ${(gz / 1024).toFixed(0)} KB gz`,
      );
    } catch (err) {
      // A stage the model can't place: skip it. The runtime `selectFrame` falls
      // back to the nearest available frame (SPEC-008 REQ-004 / edge cases).
      console.warn(`  ${stage.name}: SKIPPED (${(err as Error).message})`);
    }
  }

  const index = {
    model: MODEL,
    rotationModel: "scotese",
    licence: LICENCE,
    frames,
    // A full run writes it too, so `--present-only` is a shortcut rather than
    // the only way to get one and the two paths cannot diverge.
    present: await writePresentFrame(outDir),
  };
  await writeFile(
    join(outDir, "index.json"),
    JSON.stringify(index, null, 2) + "\n",
    "utf-8",
  );
  console.log(
    `Wrote ${frames.length}/${MESOZOIC_STAGES.length} stage frames + index.json ` +
      `(${(totalGz / 1024).toFixed(0)} KB gzipped total) → ${outDir}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
