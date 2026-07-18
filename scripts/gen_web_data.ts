/**
 * Generate the web app's static data artifact (SPEC-003 NFR-001, SPEC-002
 * REQ-006). Builds the SPEC-001 read model and writes it as prebuilt static JSON
 * into `public/data/snapshot.json`, which Vite serves/bundles verbatim; the app
 * `fetch`es it at runtime — no backend, no upstream egress at read time.
 *
 *   pnpm run gen:web-data            # committed fixture (offline, deterministic)
 *   pnpm run snapshot:app            # live PBDB+Wikidata+Wikipedia pull (--live)
 *
 * The committed `public/data/snapshot.json` is the SHIPPED dataset (a real PBDB
 * pull); refresh it with the live mode. Unit tests build from the fixture client
 * directly, so they stay deterministic regardless of the shipped artifact.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceClient } from "../src/pipeline/sources.js";
import {
  buildReadModel,
  serializeSnapshotCompact,
} from "../src/pipeline/build.js";
import { FixtureSourceClient } from "../src/pipeline/fixture-client.js";
import { HttpSourceClient } from "../src/pipeline/http-client.js";

async function main(): Promise<void> {
  const live = process.argv.slice(2).includes("--live");
  const client: SourceClient = live
    ? new HttpSourceClient({
        baseName: "Dinosauria",
        interval: "Maastrichtian",
      })
    : new FixtureSourceClient();
  if (live)
    console.log("Ingesting live from PBDB + Wikidata + Wikipedia/Commons…");

  const model = await buildReadModel(client);
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = join(repoRoot, "public", "data");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, "snapshot.json");
  await writeFile(outFile, serializeSnapshotCompact(model), "utf-8");
  console.log(
    `Wrote web data artifact (${model.taxa.length} taxa, ` +
      `${model.occurrences.length} occurrences, retrievedOn ` +
      `${model.metadata.retrievedOn}) → ${outFile}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
