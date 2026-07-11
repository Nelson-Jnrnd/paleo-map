/**
 * Build the dated snapshot artifact and write it to `data/snapshots/`.
 * Demonstrates the SPEC-001 vertical end to end: ingest → Wikidata join →
 * L1/L2 dated snapshot.
 *
 *   pnpm run snapshot           # fixture subset (offline, deterministic)
 *   pnpm run snapshot -- --live # live pull from PBDB + Wikidata + Wikipedia
 *
 * `--live` accepts `--base <PBDB base_name>` and `--interval <PBDB interval>` to
 * scope the pull (defaults: Dinosauria / Maastrichtian, paleocoords via Scotese).
 * The live adapter runs at build time only; the app read path never egresses
 * (DATA-005).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceClient } from './sources.js';
import { FixtureSourceClient } from './fixture-client.js';
import { HttpSourceClient } from './http-client.js';
import { buildReadModel, serializeSnapshot } from './build.js';

function parseArgs(argv: string[]): { live: boolean; base?: string; interval?: string } {
  const out: { live: boolean; base?: string; interval?: string } = { live: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--live') out.live = true;
    else if (a === '--base' && next) { out.base = next; i++; }
    else if (a === '--interval' && next) { out.interval = next; i++; }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let client: SourceClient;
  if (args.live) {
    console.log('Ingesting live from PBDB + Wikidata + Wikipedia/Commons…');
    client = new HttpSourceClient({
      ...(args.base ? { baseName: args.base } : {}),
      ...(args.interval ? { interval: args.interval } : {}),
    });
  } else {
    client = new FixtureSourceClient();
  }

  const model = await buildReadModel(client);
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = join(repoRoot, 'data', 'snapshots');
  await mkdir(outDir, { recursive: true });
  const slug = model.metadata.pbdbSubset.split(' ')[0]!.toLowerCase();
  const outFile = join(outDir, `${slug}-${model.metadata.retrievedOn}.json`);
  await writeFile(outFile, serializeSnapshot(model), 'utf-8');
  console.log(
    `Wrote snapshot (${model.taxa.length} taxa, ${model.occurrences.length} occurrences, ` +
      `${Object.keys(model.sources).length} sources, retrievedOn ${model.metadata.retrievedOn}, ` +
      `rotationModel ${model.metadata.rotationModel}) → ${outFile}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
