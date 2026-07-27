/**
 * Resolve and bundle per-taxon PhyloPic silhouettes (SPEC-014 REQ-004). For each
 * taxon in the shipped snapshot this resolves a PhyloPic image by scientific name,
 * falling back up the parent chain to the nearest relative that PhyloPic knows
 * (its own phylogenetic fallback plus ours), downloads each unique silhouette SVG
 * once into public/data/silhouettes/, and writes a committed index
 * (silhouettes/index.json: taxonId → local path) plus a Homo sapiens reference
 * for the size-vs-human hero.
 *
 * Read-time stays offline (DATA-005): the app serves the bundled SVGs and the
 * build reads the committed index — this crawler is a build-time step only.
 *
 *   pnpm run fetch:silhouettes
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PHYLOPIC = "https://api.phylopic.org";
const UA = "paleo-map/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)";
const HEADERS = {
  "User-Agent": UA,
  Accept: "application/vnd.phylopic.v2+json",
};

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(attempt === 1 ? 80 : 800 * (attempt - 1));
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      /* retry */
    }
  }
  return null;
}

interface NodeList {
  _links?: { items?: Array<{ href: string; title: string }> };
}
interface NodeDetail {
  _embedded?: {
    primaryImage?: {
      uuid?: string;
      _links?: { vectorFile?: { href: string } };
    };
  };
}

/** Resolve one name to { uuid, vectorUrl } via PhyloPic, or null if unknown. */
async function resolveName(
  name: string,
  build: number,
): Promise<{ uuid: string; vectorUrl: string } | null> {
  const list = await getJson<NodeList>(
    `${PHYLOPIC}/nodes?filter_name=${encodeURIComponent(name.toLowerCase())}&page=0&build=${build}`,
  );
  const item = list?._links?.items?.[0];
  if (!item) return null;
  const node = await getJson<NodeDetail>(
    `${PHYLOPIC}${item.href}&embed_primaryImage=true`,
  );
  const img = node?._embedded?.primaryImage;
  const vectorUrl = img?._links?.vectorFile?.href;
  if (!img?.uuid || !vectorUrl) return null;
  return { uuid: img.uuid, vectorUrl };
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const ref = JSON.parse(
    await readFile(join(repoRoot, "public", "data", "reference.json"), "utf-8"),
  ) as {
    taxa: Array<{
      id: string;
      scientificName: string;
      parentId: string | null;
    }>;
    profiles: Array<{ taxonId: string }>;
  };
  const taxaById = new Map(ref.taxa.map((t) => [t.id, t]));

  const root = await getJson<{ build: number }>(`${PHYLOPIC}/`);
  const build = root?.build;
  if (!build) throw new Error("could not read PhyloPic build number");
  console.log(
    `PhyloPic build ${build}; resolving ${ref.profiles.length} taxa…`,
  );

  // name → resolution (shared across taxa, since ancestors repeat)
  const nameCache = new Map<
    string,
    { uuid: string; vectorUrl: string } | null
  >();
  const resolveCached = async (
    name: string,
  ): Promise<{ uuid: string; vectorUrl: string } | null> => {
    if (!nameCache.has(name))
      nameCache.set(name, await resolveName(name, build));
    return nameCache.get(name) ?? null;
  };

  const outDir = join(repoRoot, "public", "data", "silhouettes");
  await mkdir(outDir, { recursive: true });
  const downloaded = new Set<string>();
  const vectors = new Map<string, string>(); // uuid → vectorUrl
  const taxonToUuid: Record<string, string> = {};

  let resolved = 0;
  for (const p of ref.profiles) {
    const taxon = taxaById.get(p.taxonId);
    if (!taxon) continue;
    // Try the taxon's own name, then each ancestor from nearest to root.
    const chain: string[] = [];
    let cur: typeof taxon | undefined = taxon;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id) && chain.length < 40) {
      chain.push(cur.scientificName);
      seen.add(cur.id);
      cur = cur.parentId ? taxaById.get(cur.parentId) : undefined;
    }
    for (const name of chain) {
      const hit = await resolveCached(name);
      if (hit) {
        taxonToUuid[p.taxonId] = hit.uuid;
        vectors.set(hit.uuid, hit.vectorUrl);
        resolved++;
        break;
      }
    }
  }

  // Homo sapiens reference for the size-vs-human hero.
  const human = await resolveCached("Homo sapiens");

  // Download each unique silhouette SVG once (dedup by uuid). The human ref gets
  // a stable filename so the UI can reference it directly.
  const uuids = new Set(Object.values(taxonToUuid));
  if (human) uuids.add(human.uuid);
  const basenameFor = (uuid: string): string =>
    uuid === human?.uuid ? "human" : uuid;
  const fileFor = (uuid: string): string =>
    `data/silhouettes/${basenameFor(uuid)}.svg`;
  for (const uuid of uuids) {
    if (downloaded.has(uuid)) continue;
    const url = uuid === human?.uuid ? human.vectorUrl : vectors.get(uuid);
    if (!url) continue;
    await sleep(60);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      await writeFile(
        join(
          repoRoot,
          "public",
          "data",
          "silhouettes",
          `${basenameFor(uuid)}.svg`,
        ),
        Buffer.from(await res.arrayBuffer()),
      );
      downloaded.add(uuid);
    } catch {
      /* skip a file that fails */
    }
  }

  const index = {
    human: human && downloaded.has(human.uuid) ? fileFor(human.uuid) : null,
    taxa: Object.fromEntries(
      Object.entries(taxonToUuid)
        .filter(([, uuid]) => downloaded.has(uuid))
        .map(([taxonId, uuid]) => [taxonId, fileFor(uuid)]),
    ),
  };
  await mkdir(join(repoRoot, "silhouettes"), { recursive: true });
  await writeFile(
    join(repoRoot, "silhouettes", "index.json"),
    JSON.stringify(index, null, 2) + "\n",
  );
  console.log(
    `Resolved ${resolved}/${ref.profiles.length} taxa to ${downloaded.size} unique silhouette(s); human ref: ${index.human ? "yes" : "no"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
