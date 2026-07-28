/**
 * Validate the enrichment cache (SPEC-014 REQ-002). Loads every
 * `enrichment/<taxonId>.json`, checks it against the schema, and confirms each
 * entry's taxonId exists in the shipped snapshot. Fails loudly so a malformed or
 * orphaned record can't slip into a build. Runs in CI and before authoring.
 *
 *   pnpm run validate:enrichment
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnrichmentCache } from "../src/pipeline/enrichment.js";

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  // loadEnrichmentCache throws with a path + reasons on any malformed file.
  const cache = await loadEnrichmentCache(join(repoRoot, "enrichment"));

  const ref = JSON.parse(
    await readFile(join(repoRoot, "public", "data", "reference.json"), "utf-8"),
  ) as { taxa: Array<{ id: string }> };
  const known = new Set(ref.taxa.map((t) => t.id));

  const orphans = [...cache.keys()].filter((id) => !known.has(id));
  if (orphans.length > 0) {
    console.error(
      `FAILED: ${orphans.length} enrichment record(s) reference a taxon not in the snapshot:\n  - ${orphans.join("\n  - ")}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`OK: ${cache.size} enrichment record(s) valid and in-snapshot.`);
}

main().catch((err) => {
  console.error(String(err));
  process.exitCode = 1;
});
