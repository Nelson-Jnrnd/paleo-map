/**
 * Frame-consistent occurrence reconstruction — cache builder + data migration
 * (SPEC-016 REQ-001/NFR-001/NFR-002). Reconstructs every shipped occurrence to
 * the age of the coastline frame it is displayed over (the stage midpoint), so a
 * dot registers to its coastline instead of drifting by the collection-age gap.
 *
 * It pulls REAL reconstructions from the GPlates Web Service
 * (`/reconstruct/reconstruct_points`, PALEOMAP/Scotese — the same service and
 * model as the coastlines, `scripts/fetch_basemap.ts`), writes a committed cache
 * (`public/data/reconstructions.json`), and rewrites each `stage-<slug>.json`
 * in place so the shipped centerpiece is corrected. The build
 * (`scripts/gen_web_data.ts`) applies the same cache offline, so a future rebuild
 * reproduces this result with no network (NFR-001).
 *
 * Idempotent: only (modern point, frame age) pairs missing from the cache are
 * fetched, so a re-run with a warm cache issues zero requests (NFR-002).
 *
 * Run manually to refresh the committed data:  pnpm run reconstruct:occurrences
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MESOZOIC_STAGES,
  stageMidpointMa,
  stageSlug,
} from "../src/domain/index.js";
import type { ReadOccurrence } from "../src/domain/index.js";
import { serializeCompact } from "../src/pipeline/build.js";
import {
  applyFrameReconstruction,
  reconstructionKey,
} from "../src/pipeline/reconstruction.js";
import type { ReconstructionCache } from "../src/pipeline/reconstruction.js";

const MODEL = "paleomap"; // Scotese PALEOMAP — matches PBDB pgm=scotese & coastlines
const GWS = "https://gws.gplates.org/reconstruct/reconstruct_points/";
const BATCH = 150; // points per GPlates request (keeps the GET URL well-bounded)

interface StageFile {
  occurrences: ReadOccurrence[];
}

/** A modern point to reconstruct, with the cache key it will fill. */
interface PendingPoint {
  key: string;
  lng: number;
  lat: number;
}

async function fetchBatch(
  points: PendingPoint[],
  ageMa: number,
  attempt = 1,
): Promise<Array<[number, number] | null>> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(",");
  const url = `${GWS}?points=${coords}&time=${ageMa}&model=${MODEL}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GPlates ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { coordinates?: unknown };
    const out = Array.isArray(body.coordinates) ? body.coordinates : [];
    return points.map((_, i) => {
      const c = out[i] as [number, number] | undefined;
      if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
      // GPlates returns a sentinel (|lng|>360 / |lat|>90) for points off any plate.
      if (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return null;
      return [c[0], c[1]];
    });
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
    return fetchBatch(points, ageMa, attempt + 1);
  }
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dataDir = join(repoRoot, "public", "data");
  // The cache is a build input, not a served artifact — it lives outside public/
  // alongside the other build caches (enrichment/, wikipedia/, silhouettes/).
  const cachePath = join(repoRoot, "reconstructions", "cache.json");

  const stageBySlug = new Map(
    MESOZOIC_STAGES.map((s) => [stageSlug(s.name), s]),
  );

  // Warm cache → only fetch what is missing (idempotent, NFR-002).
  const cache: ReconstructionCache = await readFile(cachePath, "utf-8")
    .then((t) => JSON.parse(t) as ReconstructionCache)
    .catch(() => ({}));
  const startSize = Object.keys(cache).length;

  const stageFiles = (await readdir(dataDir))
    .filter((n) => n.startsWith("stage-") && n.endsWith(".json"))
    .sort();

  // --- Pass 1: gather missing (point, frame age) pairs per stage, then fetch. ---
  let fetched = 0;
  for (const name of stageFiles) {
    const slug = name.slice("stage-".length, -".json".length);
    const stage = stageBySlug.get(slug);
    if (!stage) {
      console.warn(`  ${name}: no matching stage — skipped`);
      continue;
    }
    const ageMa = stageMidpointMa(stage);
    const file = JSON.parse(
      await readFile(join(dataDir, name), "utf-8"),
    ) as StageFile;

    const pending = new Map<string, PendingPoint>();
    for (const o of file.occurrences) {
      const m = o.modernPosition.value;
      if (!m) continue;
      const key = reconstructionKey(m.lng, m.lat, ageMa);
      if (cache[key] || pending.has(key)) continue;
      pending.set(key, { key, lng: m.lng, lat: m.lat });
    }
    const points = [...pending.values()];
    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH);
      const results = await fetchBatch(batch, ageMa);
      results.forEach((r, j) => {
        if (r) {
          cache[batch[j]!.key] = r;
          fetched++;
        }
      });
      await new Promise((r) => setTimeout(r, 200)); // be polite to GWS
    }
    console.log(
      `  ${stage.name.padEnd(14)} ${String(ageMa).padStart(6)} Ma  ` +
        `${file.occurrences.length} occ, ${points.length} new point(s)`,
    );
  }

  // Write the cache (sorted keys → byte-stable, NFR-001).
  await writeFile(cachePath, serializeCompact(cache), "utf-8");

  // --- Pass 2: apply the (now complete) cache to each stage file, rewrite it. ---
  let rewritten = 0;
  for (const name of stageFiles) {
    const slug = name.slice("stage-".length, -".json".length);
    const stage = stageBySlug.get(slug);
    if (!stage) continue;
    const ageMa = stageMidpointMa(stage);
    const path = join(dataDir, name);
    const file = JSON.parse(await readFile(path, "utf-8")) as StageFile;
    const occurrences = applyFrameReconstruction(
      file.occurrences,
      ageMa,
      cache,
    );
    await writeFile(path, serializeCompact({ occurrences }), "utf-8");
    rewritten++;
  }

  console.log(
    `\nReconstruction cache: ${startSize} → ${Object.keys(cache).length} entries ` +
      `(+${fetched} fetched); rewrote ${rewritten} stage file(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
