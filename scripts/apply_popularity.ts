/**
 * Apply the committed pageview cache to the shipped reference artifact
 * (SPEC-020 REQ-001), without re-ingesting from PBDB.
 *
 * `scripts/gen_web_data.ts` already folds popularity in, so a full snapshot
 * rebuild produces the same result — but a full rebuild also re-fetches every
 * occurrence, collection and image from live sources, which is a much larger and
 * riskier operation than attaching one derived field. This script exists so the
 * popularity refresh (a deliberate, occasional act) does not force a full
 * re-ingest, and it reuses the same `applyPopularity` and serializer as the
 * build so the artifact stays byte-identical to what a rebuild would emit.
 *
 *   pnpm tsx scripts/apply_popularity.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadModel } from "../src/domain/snapshot.js";
import { serializeCompact } from "../src/pipeline/build.js";
import {
  applyPopularity,
  loadPopularityCache,
} from "../src/pipeline/popularity.js";

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const referencePath = join(repoRoot, "public", "data", "reference.json");

  const reference = JSON.parse(
    await readFile(referencePath, "utf-8"),
  ) as ReadModel;
  const cache = await loadPopularityCache(
    join(repoRoot, "popularity", "pageviews.json"),
  );
  if (Object.keys(cache.entries).length === 0) {
    console.error(
      "No popularity cache found. Run `pnpm run fetch:popularity` first.",
    );
    process.exitCode = 1;
    return;
  }

  const updated = applyPopularity(reference, cache);
  const ranked = updated.profiles.filter(
    (p) => typeof p.popularity === "number",
  ).length;
  await writeFile(referencePath, serializeCompact(updated), "utf-8");

  const before = (await readFile(referencePath, "utf-8")).length;
  console.log(
    `Applied ${Object.keys(cache.entries).length} cached figure(s) → ` +
      `${ranked} profile(s) ranked (${cache.window}, retrieved ${cache.retrievedOn})\n` +
      `  ${referencePath} is now ${(before / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
