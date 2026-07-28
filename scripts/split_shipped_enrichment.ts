/**
 * One-off migration (SPEC-014 AMEND-004): split inline enrichment out of the
 * already-shipped live artifacts without a full regeneration. Reads the
 * committed public/data/reference.json + index.json, moves every profile's
 * enrichment record into public/data/enrichment.json (keyed by taxonId), nulls
 * it on the served profiles, and records the enrichmentUrl on the index. Uses
 * the canonical compact serializer so the rewritten files stay byte-stable with
 * a normal `pnpm run gen:web-data`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serializeCompact } from "../src/pipeline/build.js";
import type { EnrichmentRecord } from "../src/domain/index.js";

interface Profile {
  taxonId: string;
  enrichment: EnrichmentRecord | null;
  [k: string]: unknown;
}
interface Reference {
  profiles: Profile[];
  [k: string]: unknown;
}
interface Index {
  referenceUrl: string;
  enrichmentUrl?: string;
  [k: string]: unknown;
}

async function main(): Promise<void> {
  const dir = join(process.cwd(), "public", "data");
  const reference = JSON.parse(
    await readFile(join(dir, "reference.json"), "utf-8"),
  ) as Reference;
  const index = JSON.parse(
    await readFile(join(dir, "index.json"), "utf-8"),
  ) as Index;

  const enrichment: Record<string, EnrichmentRecord> = {};
  reference.profiles = reference.profiles.map((p) => {
    if (p.enrichment) {
      enrichment[p.taxonId] = p.enrichment;
      return { ...p, enrichment: null };
    }
    return p;
  });
  index.enrichmentUrl = "data/enrichment.json";

  await writeFile(join(dir, "reference.json"), serializeCompact(reference), "utf-8");
  await writeFile(join(dir, "enrichment.json"), serializeCompact(enrichment), "utf-8");
  await writeFile(join(dir, "index.json"), serializeCompact(index), "utf-8");

  console.log(
    `Split ${Object.keys(enrichment).length} enrichment record(s) → enrichment.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
