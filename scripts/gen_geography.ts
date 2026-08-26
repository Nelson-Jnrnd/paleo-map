/**
 * Generate the per-taxon country index (SPEC-028 REQ-001, DATA-001).
 *
 *   public/data/geography.json  — { generatedFrom, countriesByTaxon }
 *
 * **Why a separate artifact rather than a new profile field.** A profile field
 * would have to come out of `derive.ts`, which means regenerating
 * `reference.json` — and the offline `gen:web-data` path builds from the
 * *fixture* client, so regenerating offline would silently replace the shipped
 * 1,731-genus dataset with the fixture subset. This script instead derives an
 * index *over* the committed artifacts, so it is reproducible with no network
 * and no risk to the shipped data.
 *
 * The fold itself lives in `src/pipeline/geography.ts` so it is unit-testable
 * without files — the same split `fetch_silhouettes.ts` and `silhouettes.ts`
 * already use.
 *
 * Run manually to refresh the committed index:  pnpm run gen:geography
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadOccurrence } from "../src/domain/index.js";
import { indexCountries } from "../src/pipeline/geography.js";
import type { GeographyIndex } from "../src/pipeline/geography.js";

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dataDir = join(repoRoot, "public", "data");

  const reference = JSON.parse(
    await readFile(join(dataDir, "reference.json"), "utf-8"),
  ) as { metadata: { retrievedOn: string }; taxa: { id: string }[] };
  const knownTaxa = new Set(reference.taxa.map((t) => t.id));

  // Sorted, so the fold sees occurrences in the same order on every run.
  const stageFiles = (await readdir(dataDir))
    .filter((f) => f.startsWith("stage-") && f.endsWith(".json"))
    .sort();

  const occurrences: ReadOccurrence[] = [];
  for (const file of stageFiles) {
    const parsed = JSON.parse(await readFile(join(dataDir, file), "utf-8")) as {
      occurrences?: ReadOccurrence[];
    };
    occurrences.push(...(parsed.occurrences ?? []));
  }

  // Some occurrences name a taxon the reference does not carry — 78 of them in
  // the shipped snapshot, from ranks the reference prunes. An entry the app
  // could never resolve is dead weight, and keeping it would make DATA-001's
  // "every id exists in the reference" invariant false.
  const countriesByTaxon = indexCountries(
    occurrences.filter((o) => knownTaxa.has(o.taxonId)),
  );
  const index: GeographyIndex = {
    generatedFrom: reference.metadata.retrievedOn,
    countriesByTaxon,
  };

  const out = join(dataDir, "geography.json");
  const serialized = JSON.stringify(index);
  await writeFile(out, serialized, "utf-8");

  const codes = new Set(Object.values(countriesByTaxon).flat());
  console.log(
    `Wrote ${out}\n` +
      `  ${stageFiles.length} stage files, ${occurrences.length} occurrences\n` +
      `  ${Object.keys(countriesByTaxon).length} taxa, ${codes.size} countries, ` +
      `${(serialized.length / 1024).toFixed(1)} KB (snapshot ${index.generatedFrom})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
