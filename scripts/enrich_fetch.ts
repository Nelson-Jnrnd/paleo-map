/**
 * Agent-authoring helper for the enrichment cache (SPEC-014 REQ-002, Engine A).
 * Given taxon names (or `--top N` for the highest-occurrence taxa in the shipped
 * snapshot), fetch each one's Wikipedia article plaintext + current `revid` and
 * its taxonId from `public/data/reference.json`, and print a JSON bundle. The
 * coding agent reads that bundle, extracts an `EnrichmentRecord` per the schema
 * (extract-don't-invent), and writes `enrichment/<taxonId>.json`.
 *
 * This is a *read* helper only — it calls no LLM. It exists so authoring is
 * mechanical and the source article + revid are captured for freshness.
 *
 *   pnpm tsx scripts/enrich_fetch.ts Tyrannosaurus Triceratops
 *   pnpm tsx scripts/enrich_fetch.ts --top 20 > /tmp/enrich.json
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENWIKI_API = "https://en.wikipedia.org/w/api.php";
const UA =
  "paleo-map-enrichment/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)";

interface Bundle {
  taxonId: string;
  taxonName: string;
  article: string;
  url: string;
  revid: number;
  extract: string;
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const ref = JSON.parse(
    await readFile(join(repoRoot, "public", "data", "reference.json"), "utf-8"),
  ) as {
    taxa: Array<{ id: string; scientificName: string; rank: string }>;
    profiles: Array<{ taxonId: string; occurrenceCount: number }>;
  };
  const nameById = new Map(ref.taxa.map((t) => [t.id, t.scientificName]));
  const idByName = new Map(ref.taxa.map((t) => [t.scientificName, t.id]));

  const args = process.argv.slice(2);
  let names: string[];
  const topIdx = args.indexOf("--top");
  if (topIdx >= 0) {
    const n = Number(args[topIdx + 1] ?? "20");
    names = [...ref.profiles]
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .map((p) => nameById.get(p.taxonId))
      .filter((x): x is string => Boolean(x))
      .slice(0, n);
  } else {
    names = args;
  }
  if (names.length === 0) {
    console.error("usage: enrich_fetch.ts <TaxonName…> | --top N");
    process.exitCode = 1;
    return;
  }

  const bundles: Bundle[] = [];
  for (const name of names) {
    const taxonId = idByName.get(name);
    if (!taxonId) {
      console.error(`! no taxon in reference.json named "${name}" — skipping`);
      continue;
    }
    const url =
      `${ENWIKI_API}?action=query&format=json&formatversion=2` +
      `&prop=extracts|revisions&rvprop=ids&explaintext=1&redirects=1` +
      `&titles=${encodeURIComponent(name)}`;
    const data = (await (
      await fetch(url, { headers: { "User-Agent": UA } })
    ).json()) as {
      query?: {
        pages?: Array<{
          title: string;
          missing?: boolean;
          extract?: string;
          revisions?: Array<{ revid: number }>;
        }>;
      };
    };
    const page = data.query?.pages?.[0];
    if (!page || page.missing || !page.extract || !page.revisions?.[0]) {
      console.error(`! no Wikipedia article for "${name}" — skipping`);
      continue;
    }
    bundles.push({
      taxonId,
      taxonName: name,
      article: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      revid: page.revisions[0].revid,
      extract: page.extract,
    });
  }

  process.stdout.write(JSON.stringify(bundles, null, 2) + "\n");
  console.error(`fetched ${bundles.length}/${names.length} article(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
