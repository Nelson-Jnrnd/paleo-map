/**
 * Generate the web app's static data artifacts (SPEC-008 REQ-005; SPEC-002
 * REQ-006). Builds the SPEC-001 read model, then partitions it by stage into the
 * artifacts the app actually fetches:
 *
 *   public/data/index.json          — boot index (stages → data/basemap URLs, counts, bounds)
 *   public/data/reference.json      — shared metadata + sources + taxa + profiles
 *   public/data/stage-<slug>.json   — { occurrences } for each stage with data
 *
 * Vite serves/bundles these verbatim; the app fetches the index and reference at
 * boot and only the active stage's file thereafter — no backend, no upstream
 * egress at read time (SPEC-001 DATA-005).
 *
 *   pnpm run gen:web-data            # committed fixture (offline, deterministic)
 *   pnpm run snapshot:app            # live full-Mesozoic PBDB pull (--live)
 *
 * The committed artifacts are the SHIPPED dataset (a real PBDB pull); refresh
 * them with the live mode. Unit tests build from the fixture client directly, so
 * they stay deterministic regardless of the shipped artifacts.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceClient } from "../src/pipeline/sources.js";
import { buildReadModel, serializeCompact } from "../src/pipeline/build.js";
import { partitionReadModel } from "../src/pipeline/partition.js";
import { FixtureSourceClient } from "../src/pipeline/fixture-client.js";
import { HttpSourceClient } from "../src/pipeline/http-client.js";

async function main(): Promise<void> {
  const live = process.argv.slice(2).includes("--live");
  const client: SourceClient = live
    ? new HttpSourceClient({ baseName: "Dinosauria" })
    : new FixtureSourceClient();
  if (live)
    console.log(
      "Ingesting live full-Mesozoic (Triassic/Jurassic/Cretaceous) from PBDB + Wikidata + Wikipedia/Commons…",
    );

  const model = await buildReadModel(client);
  const partition = partitionReadModel(model);

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = join(repoRoot, "public", "data");
  await mkdir(outDir, { recursive: true });

  // Clear stale artifacts (the old single snapshot.json and any previous stage
  // files) so the emitted set is exactly the current partitioning.
  for (const name of await readdir(outDir).catch(() => [])) {
    if (name === "snapshot.json" || name.startsWith("stage-")) {
      await rm(join(outDir, name));
    }
  }

  await writeFile(
    join(outDir, "index.json"),
    serializeCompact(partition.index),
    "utf-8",
  );
  await writeFile(
    join(outDir, "reference.json"),
    serializeCompact(partition.reference),
    "utf-8",
  );
  for (const stage of partition.stages) {
    await writeFile(
      join(outDir, `stage-${stage.slug}.json`),
      serializeCompact({ occurrences: stage.occurrences }),
      "utf-8",
    );
  }

  const withData = partition.index.stages.filter((s) => s.occurrenceCount > 0);
  console.log(
    `Wrote partitioned web data → ${outDir}\n` +
      `  index.json + reference.json (${model.taxa.length} taxa, ${model.profiles.length} profiles)\n` +
      `  ${withData.length}/${partition.index.stages.length} stages with occurrences, ` +
      `${model.occurrences.length} occurrences total (retrievedOn ${model.metadata.retrievedOn})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
