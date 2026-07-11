/**
 * Generate the web app's static data artifact (SPEC-003 NFR-001, SPEC-002
 * REQ-006). Builds the SPEC-001 read model from the committed fixture subset and
 * writes it as prebuilt static JSON into `public/data/`, where Vite serves and
 * bundles it verbatim. The app `fetch`es this file at runtime — no backend, no
 * upstream egress. Run automatically by `predev`/`prebuild`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReadModel, serializeSnapshot } from '../src/pipeline/build.js';
import { FixtureSourceClient } from '../src/pipeline/fixture-client.js';

async function main(): Promise<void> {
  const model = await buildReadModel(new FixtureSourceClient());
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(repoRoot, 'public', 'data');
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, 'snapshot.json');
  await writeFile(outFile, serializeSnapshot(model), 'utf-8');
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
