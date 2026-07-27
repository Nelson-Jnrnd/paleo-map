/**
 * Size-budget gate (SPEC-002 NFR-001; SPEC-003 AMEND-002; SPEC-008 NFR-002).
 * Fails CI if the production JS bundle or any served data/basemap artifact
 * exceeds its documented budget, so none can silently balloon. With SPEC-008 the
 * data is partitioned, so the gate ceilings **each** artifact: the shared
 * reference, the index, every per-stage data file, and every basemap frame.
 * Budgets are transferred (gzipped) sizes, since that is what a CDN serves and
 * what the PERF budgets care about — plus a raw ceiling on the big files for repo
 * hygiene.
 *
 *   pnpm run gen:web-data && pnpm run build && pnpm run check:budget
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

interface Budget {
  label: string;
  actualBytes: number;
  budgetBytes: number;
}

const KB = 1024;
const MB = 1024 * 1024;

// Per-artifact gzip ceilings (SPEC-008 NFR-002). Set from the measured
// full-Mesozoic pull (2124 taxa / 22081 occurrences, retrievedOn 2026-07-21)
// plus ~25% headroom, per the spec's "budgets are measured, not decided up
// front" open question. Measured sizes print on every run.
//   reference.json ≈ 1.07 MB gz; richest stage (Campanian) ≈ 0.37 MB gz / 5.8 MB raw.
const REFERENCE_GZIP = 1600 * KB;
const REFERENCE_RAW = 8 * MB;
const INDEX_GZIP = 32 * KB;
const STAGE_GZIP = 500 * KB;
const STAGE_RAW = 7 * MB;
const BASEMAP_FRAME_GZIP = 150 * KB;
const BASEMAP_INDEX_GZIP = 16 * KB;
const JS_BUNDLE_GZIP = 320 * KB;
// Bundled taxon-profile thumbnails (SPEC-012 REQ-002). Already-compressed
// binaries, so budget the RAW bytes: a per-image cap and an aggregate ceiling.
// Sized to the shipped live pull (≈926 images / 43 MB, largest ≈0.94 MB) plus
// headroom; if the set grows past this, slim the thumbnails or the taxa covered.
// A few Commons files return no 320px thumbnail and fall back to a larger
// original; allow up to 3 MB each (rare) since the aggregate is capped anyway.
const IMAGE_RAW = 3 * MB;
// Gallery bundling (SPEC-014 REQ-003) is capped at ~90 MB total by the generator;
// gate a little above that so one last extra crossing the cap doesn't fail CI.
const IMAGES_TOTAL_RAW = 100 * MB;
// Bundled PhyloPic silhouettes (SPEC-014 REQ-004): small vector SVGs, deduped by
// image, so the aggregate stays modest. Budget the total raw bytes.
const SILHOUETTES_TOTAL_RAW = 12 * MB;

async function gzipBytes(path: string): Promise<number> {
  return gzipSync(await readFile(path)).length;
}

async function main(): Promise<void> {
  const checks: Budget[] = [];

  // --- Data artifacts: index + shared reference + per-stage files ---
  const dataDir = "public/data";
  const dataFiles = await readdir(dataDir).catch(() => [] as string[]);
  for (const name of dataFiles) {
    // The bundled images + silhouettes live in their own subdirectories,
    // budgeted separately below.
    if (name === "images" || name === "silhouettes") continue;
    const path = join(dataDir, name);
    const gz = await gzipBytes(path);
    if (name === "index.json") {
      checks.push({
        label: "data/index.json (gzip)",
        actualBytes: gz,
        budgetBytes: INDEX_GZIP,
      });
    } else if (name === "reference.json") {
      checks.push({
        label: "data/reference.json (gzip)",
        actualBytes: gz,
        budgetBytes: REFERENCE_GZIP,
      });
      checks.push({
        label: "data/reference.json (raw)",
        actualBytes: (await stat(path)).size,
        budgetBytes: REFERENCE_RAW,
      });
    } else if (name.startsWith("stage-")) {
      checks.push({
        label: `data/${name} (gzip)`,
        actualBytes: gz,
        budgetBytes: STAGE_GZIP,
      });
      checks.push({
        label: `data/${name} (raw)`,
        actualBytes: (await stat(path)).size,
        budgetBytes: STAGE_RAW,
      });
    }
  }

  // --- Bundled profile images (SPEC-012 REQ-002): per-image + aggregate raw ---
  const imagesDir = join(dataDir, "images");
  const imageFiles = await readdir(imagesDir).catch(() => [] as string[]);
  let imagesTotalRaw = 0;
  for (const name of imageFiles) {
    const raw = (await stat(join(imagesDir, name))).size;
    imagesTotalRaw += raw;
    checks.push({
      label: `data/images/${name} (raw)`,
      actualBytes: raw,
      budgetBytes: IMAGE_RAW,
    });
  }
  if (imageFiles.length > 0) {
    checks.push({
      label: "data/images total (raw)",
      actualBytes: imagesTotalRaw,
      budgetBytes: IMAGES_TOTAL_RAW,
    });
  }

  // --- Bundled PhyloPic silhouettes (SPEC-014 REQ-004): aggregate raw ---
  const silDir = join(dataDir, "silhouettes");
  const silFiles = await readdir(silDir).catch(() => [] as string[]);
  if (silFiles.length > 0) {
    let silTotalRaw = 0;
    for (const name of silFiles)
      silTotalRaw += (await stat(join(silDir, name))).size;
    checks.push({
      label: "data/silhouettes total (raw)",
      actualBytes: silTotalRaw,
      budgetBytes: SILHOUETTES_TOTAL_RAW,
    });
  }

  // --- Basemap frames + index ---
  const basemapDir = "public/basemap";
  const basemapFiles = await readdir(basemapDir).catch(() => [] as string[]);
  for (const name of basemapFiles) {
    if (name === "index.json") {
      checks.push({
        label: "basemap/index.json (gzip)",
        actualBytes: await gzipBytes(join(basemapDir, name)),
        budgetBytes: BASEMAP_INDEX_GZIP,
      });
    } else if (name.endsWith(".geojson")) {
      checks.push({
        label: `basemap/${name} (gzip)`,
        actualBytes: await gzipBytes(join(basemapDir, name)),
        budgetBytes: BASEMAP_FRAME_GZIP,
      });
    }
  }

  // --- Production JS bundle: total gzipped across all emitted chunks. ---
  const assetsDir = "dist/assets";
  let jsGz = 0;
  try {
    for (const name of await readdir(assetsDir)) {
      if (name.endsWith(".js")) jsGz += await gzipBytes(join(assetsDir, name));
    }
    checks.push({
      label: "app JS bundle (gzip, all chunks)",
      actualBytes: jsGz,
      budgetBytes: JS_BUNDLE_GZIP,
    });
  } catch {
    console.warn(
      "! dist/ not found — run `pnpm run build` first to budget the JS bundle.",
    );
  }

  let failed = false;
  console.log("== Size budgets ==\n");
  for (const c of checks) {
    const ok = c.actualBytes <= c.budgetBytes;
    if (!ok) failed = true;
    const pct = ((c.actualBytes / c.budgetBytes) * 100).toFixed(0);
    console.log(
      `${ok ? "OK  " : "FAIL"}  ${c.label.padEnd(40)} ` +
        `${(c.actualBytes / KB).toFixed(0).padStart(6)} KB / ${(c.budgetBytes / KB).toFixed(0)} KB (${pct}%)`,
    );
  }
  if (failed) {
    console.error("\nFAILED: a size budget was exceeded.");
    process.exitCode = 1;
  } else {
    console.log("\nOK: all sizes within budget.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
