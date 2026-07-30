/**
 * Build-time Wikipedia resolver (SPEC-014 AMEND-005). Resolves every taxon in the
 * shipped snapshot against the MediaWiki API — existence + canonical title, with
 * redirects followed — and writes `wikipedia/resolution.json`
 * (`taxonId → { title, url } | null`). This is the *only* place Wikipedia is
 * contacted; the app build reads the committed file and never egresses, so
 * runtime stays offline and deterministic (DATA-005).
 *
 *   pnpm tsx scripts/resolve_wikipedia.ts            # resolve all taxa
 *   pnpm tsx scripts/resolve_wikipedia.ts --limit 50 # first 50 (smoke test)
 *
 * Known limitation: a name that is a Wikipedia disambiguation page resolves as
 * "exists" (we cannot cheaply tell it apart here). Rare for dinosaur genera.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WikipediaRef } from "../src/domain/snapshot.js";
import type { WikipediaResolution } from "../src/pipeline/wikipedia.js";

const ENWIKI_API = "https://en.wikipedia.org/w/api.php";
const UA =
  "paleo-map-wikiresolve/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)";
const BATCH = 50; // MediaWiki titles-per-query cap for non-bot clients.

interface MwQuery {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{ title: string; missing?: boolean }>;
  };
}

/** Article URL from a canonical title (spaces → underscores, percent-encoded). */
function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Resolve one batch of names → `name → ref | null`, following redirects. */
async function resolveBatch(
  names: string[],
): Promise<Map<string, WikipediaRef | null>> {
  const url =
    `${ENWIKI_API}?action=query&format=json&formatversion=2&redirects=1` +
    `&titles=${names.map((n) => encodeURIComponent(n)).join("|")}`;
  const data = (await (
    await fetch(url, { headers: { "User-Agent": UA } })
  ).json()) as MwQuery;
  const norm = new Map(
    (data.query?.normalized ?? []).map((n) => [n.from, n.to]),
  );
  const redir = new Map(
    (data.query?.redirects ?? []).map((r) => [r.from, r.to]),
  );
  const pageByTitle = new Map(
    (data.query?.pages ?? []).map((p) => [p.title, p]),
  );

  const out = new Map<string, WikipediaRef | null>();
  for (const name of names) {
    let title = norm.get(name) ?? name;
    // Follow redirect chains (guard against cycles).
    for (let hops = 0; redir.has(title) && hops < 5; hops++)
      title = redir.get(title)!;
    const page = pageByTitle.get(title);
    out.set(
      name,
      !page || page.missing
        ? null
        : { title: page.title, url: articleUrl(page.title) },
    );
  }
  return out;
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const ref = JSON.parse(
    await readFile(join(repoRoot, "public", "data", "reference.json"), "utf-8"),
  ) as { taxa: Array<{ id: string; scientificName: string }> };

  const args = process.argv.slice(2);
  const limIdx = args.indexOf("--limit");
  let taxa = ref.taxa;
  if (limIdx >= 0) taxa = taxa.slice(0, Number(args[limIdx + 1] ?? "50"));

  // De-dupe by name (several taxa can share a name only in theory; ids are unique).
  const idsByName = new Map<string, string[]>();
  for (const t of taxa) {
    const list = idsByName.get(t.scientificName) ?? [];
    list.push(t.id);
    idsByName.set(t.scientificName, list);
  }
  const names = [...idsByName.keys()];

  const entries: Record<string, WikipediaRef | null> = {};
  let resolved = 0;
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const map = await resolveBatch(batch);
    for (const [name, ref2] of map) {
      if (ref2) resolved++;
      for (const id of idsByName.get(name) ?? []) entries[id] = ref2;
    }
    console.error(
      `resolved ${Math.min(i + BATCH, names.length)}/${names.length} names…`,
    );
  }

  const resolution: WikipediaResolution = {
    resolvedOn: new Date().toISOString().slice(0, 10),
    entries,
  };
  const outDir = join(repoRoot, "wikipedia");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "resolution.json"),
    JSON.stringify(resolution, null, 2) + "\n",
  );
  console.error(
    `wrote wikipedia/resolution.json — ${resolved}/${names.length} names have an article ` +
      `(${taxa.length} taxa covered)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
