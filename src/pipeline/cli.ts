/**
 * Build the dated snapshot artifact from the fixture subset and write it to
 * `data/snapshots/`. Demonstrates the SPEC-001 vertical end to end:
 * ingest → Wikidata join → L1/L2 dated snapshot. Run with `pnpm run snapshot`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FixtureSourceClient } from './fixture-client.js';
import { buildReadModel, serializeSnapshot } from './build.js';

async function main(): Promise<void> {
  const model = await buildReadModel(new FixtureSourceClient());
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = join(repoRoot, 'data', 'snapshots');
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `dinosauria-${model.metadata.retrievedOn}.json`);
  await writeFile(outFile, serializeSnapshot(model), 'utf-8');
  console.log(
    `Wrote snapshot (${model.taxa.length} taxa, ${model.occurrences.length} occurrences, ` +
      `retrievedOn ${model.metadata.retrievedOn}, rotationModel ${model.metadata.rotationModel}) → ${outFile}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
