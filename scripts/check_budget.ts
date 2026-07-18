/**
 * Size-budget gate (SPEC-002 NFR-001; SPEC-003 AMEND-002). Fails CI if the
 * production JS bundle or the served data artifact exceed documented budgets, so
 * neither can silently balloon. Budgets are transferred (gzipped) sizes, since
 * that is what a CDN serves and what the PERF budgets care about — plus a raw
 * ceiling on the data file for repo hygiene.
 *
 *   pnpm run build && pnpm run check:budget
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

async function gzipBytes(path: string): Promise<number> {
  return gzipSync(await readFile(path)).length;
}

async function main(): Promise<void> {
  const checks: Budget[] = [];

  // Data artifact: gzipped (what the CDN serves) + a raw ceiling (repo hygiene).
  const dataPath = "public/data/snapshot.json";
  const dataRaw = (await stat(dataPath)).size;
  const dataGz = await gzipBytes(dataPath);
  checks.push({
    label: "data artifact (gzip)",
    actualBytes: dataGz,
    budgetBytes: 550 * KB,
  });
  checks.push({
    label: "data artifact (raw)",
    actualBytes: dataRaw,
    budgetBytes: 5 * MB,
  });

  // Production JS bundle: total gzipped across all emitted chunks. The map engine
  // (MapLibre) dominates and is expected (SPEC-002 §4); the budget has headroom.
  const assetsDir = "dist/assets";
  let jsGz = 0;
  try {
    for (const name of await readdir(assetsDir)) {
      if (name.endsWith(".js")) jsGz += await gzipBytes(join(assetsDir, name));
    }
    checks.push({
      label: "app JS bundle (gzip, all chunks)",
      actualBytes: jsGz,
      budgetBytes: 320 * KB,
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
      `${ok ? "OK  " : "FAIL"}  ${c.label.padEnd(34)} ` +
        `${(c.actualBytes / KB).toFixed(0).padStart(5)} KB / ${(c.budgetBytes / KB).toFixed(0)} KB (${pct}%)`,
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
