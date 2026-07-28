/**
 * Engine B runner (SPEC-014 REQ-002, the optional batch script). Authors the
 * long tail of enrichment records by extraction, using the Anthropic **Message
 * Batches** API (half-price, built for thousands of one-off requests). It selects
 * genera that have no cache file yet, fetches each one's Wikipedia article + revid
 * (the same freshness key Engine A captures), sends one extraction request per
 * taxon, then parses every reply into a schema-clean record, validates it with the
 * shared `validateCacheEntry`, and writes `enrichment/<taxonId>.json`.
 *
 * The build never runs this — it only reads the committed cache. This script is a
 * one-off authoring tool; commit the cache files it produces.
 *
 *   ANTHROPIC_API_KEY=… pnpm tsx scripts/enrich_batch.ts --top 200
 *   ANTHROPIC_API_KEY=… pnpm tsx scripts/enrich_batch.ts --all
 *   pnpm tsx scripts/enrich_batch.ts --top 20 --dry-run   # no key, no API call
 *
 * Flags:
 *   --top N        author the N highest-occurrence un-enriched genera (default 50)
 *   --all          author every un-enriched genus that has a Wikipedia article
 *   --limit N      hard cap on requests actually submitted
 *   --model ID     Claude model to extract with (default claude-sonnet-5)
 *   --dry-run      fetch articles + build the batch payload, write it, DO NOT call the API
 *   --max-wait M   minutes to poll for the batch to finish (default 120)
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildUserPrompt,
  EXTRACTION_SYSTEM,
  parseRecordText,
  toCacheEntry,
  type ArticleBundle,
} from '../src/pipeline/enrich-batch.js';
import { validateCacheEntry } from '../src/pipeline/enrichment.js';

const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'paleo-map-enrichment/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Args {
  top: number;
  all: boolean;
  limit: number | null;
  model: string;
  dryRun: boolean;
  maxWaitMin: number;
  names: string[];
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    top: 50,
    all: false,
    limit: null,
    model: DEFAULT_MODEL,
    dryRun: false,
    maxWaitMin: 120,
    names: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--all') a.all = true;
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--top') a.top = Number(argv[++i] ?? '50');
    else if (t === '--limit') a.limit = Number(argv[++i] ?? '0');
    else if (t === '--model') a.model = argv[++i] ?? DEFAULT_MODEL;
    else if (t === '--max-wait') a.maxWaitMin = Number(argv[++i] ?? '120');
    else if (t && !t.startsWith('--')) a.names.push(t);
  }
  return a;
}

/** custom_id must be [a-zA-Z0-9_-]; taxonIds contain a colon. */
const toCustomId = (taxonId: string): string => taxonId.replace(/[^a-zA-Z0-9_-]/g, '_');

interface RefTaxon { id: string; scientificName: string; rank: string }
interface RefProfile { taxonId: string; occurrenceCount: number }

/** Pick the target genera: un-cached, genus-rank, ranked by occurrence count. */
async function selectTargets(args: Args): Promise<ArticleBundle[]> {
  const ref = JSON.parse(
    await readFile(join(repoRoot, 'public', 'data', 'reference.json'), 'utf-8'),
  ) as { taxa: RefTaxon[]; profiles: RefProfile[] };
  const taxonById = new Map(ref.taxa.map((t) => [t.id, t]));
  const idByName = new Map(ref.taxa.map((t) => [t.scientificName, t.id]));

  const cached = new Set(
    (await readdir(join(repoRoot, 'enrichment')).catch(() => [] as string[]))
      .filter((n) => n.endsWith('.json'))
      .map((n) => n.replace(/\.json$/, '').replace(/^txn_/, 'txn:')),
  );

  let wanted: string[]; // scientific names
  if (args.names.length > 0) {
    wanted = args.names;
  } else {
    const genusProfiles = ref.profiles
      .filter((p) => taxonById.get(p.taxonId)?.rank === 'Genus')
      .filter((p) => !cached.has(p.taxonId))
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
    const picked = args.all ? genusProfiles : genusProfiles.slice(0, args.top);
    wanted = picked
      .map((p) => taxonById.get(p.taxonId)?.scientificName)
      .filter((x): x is string => Boolean(x));
  }

  const bundles: ArticleBundle[] = [];
  let fetched = 0;
  for (const name of wanted) {
    const taxonId = idByName.get(name);
    if (!taxonId) {
      console.error(`! no taxon named "${name}" — skipping`);
      continue;
    }
    if (cached.has(taxonId)) continue; // already authored
    const bundle = await fetchArticle(taxonId, name);
    if (bundle) bundles.push(bundle);
    if (++fetched % 25 === 0) console.error(`  …fetched ${fetched} article(s)`);
    if (args.limit !== null && bundles.length >= args.limit) break;
    await sleep(300); // ~3 req/s, polite to the Wikipedia API
  }
  return bundles;
}

async function fetchArticle(taxonId: string, name: string): Promise<ArticleBundle | null> {
  const url =
    `${ENWIKI_API}?action=query&format=json&formatversion=2` +
    `&prop=extracts|revisions&rvprop=ids&explaintext=1&redirects=1` +
    `&titles=${encodeURIComponent(name)}`;
  try {
    const data = (await (await fetch(url, { headers: { 'User-Agent': UA } })).json()) as {
      query?: { pages?: Array<{ title: string; missing?: boolean; extract?: string; revisions?: Array<{ revid: number }> }> };
    };
    const page = data.query?.pages?.[0];
    if (!page || page.missing || !page.extract || !page.revisions?.[0]) {
      console.error(`! no Wikipedia article for "${name}" — skipping`);
      return null;
    }
    return {
      taxonId,
      taxonName: name,
      article: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      revid: page.revisions[0].revid,
    };
  } catch (err) {
    console.error(`! fetch failed for "${name}": ${String(err)}`);
    return null;
  }
}

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user'; content: string }>;
  };
}

function buildBatchRequests(bundles: ArticleBundle[], model: string): BatchRequest[] {
  return bundles.map((b) => ({
    custom_id: toCustomId(b.taxonId),
    params: {
      model,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: buildUserPrompt(b.taxonName, b.article) }],
    },
  }));
}

async function anthropic(path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  return fetch(`${ANTHROPIC_BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

/** Submit the batch, poll to completion, return each custom_id's text reply. */
async function runBatch(
  requests: BatchRequest[],
  apiKey: string,
  maxWaitMin: number,
): Promise<Map<string, string>> {
  const create = await anthropic('', apiKey, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
  if (!create.ok) {
    throw new Error(`batch create failed (${create.status}): ${await create.text()}`);
  }
  const batch = (await create.json()) as { id: string };
  console.error(`Batch ${batch.id} submitted with ${requests.length} request(s).`);

  const deadline = Date.now() + maxWaitMin * 60_000;
  let resultsUrl: string | null = null;
  for (;;) {
    await sleep(20_000);
    const poll = await anthropic(`/${batch.id}`, apiKey);
    if (!poll.ok) throw new Error(`batch poll failed (${poll.status})`);
    const status = (await poll.json()) as {
      processing_status: string;
      results_url: string | null;
      request_counts?: Record<string, number>;
    };
    console.error(
      `  status=${status.processing_status} counts=${JSON.stringify(status.request_counts ?? {})}`,
    );
    if (status.processing_status === 'ended') {
      resultsUrl = status.results_url;
      break;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `batch ${batch.id} not finished within ${maxWaitMin} min — re-run once it ends to collect results`,
      );
    }
  }
  if (!resultsUrl) throw new Error('batch ended with no results_url');

  const res = await anthropic(resultsUrl.replace(ANTHROPIC_BASE, ''), apiKey);
  const jsonl = await res.text();
  const out = new Map<string, string>();
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as {
      custom_id: string;
      result: { type: string; message?: { content?: Array<{ type: string; text?: string }> } };
    };
    if (row.result.type !== 'succeeded') {
      console.error(`! ${row.custom_id}: ${row.result.type}`);
      continue;
    }
    const text = row.result.message?.content?.find((c) => c.type === 'text')?.text;
    if (text) out.set(row.custom_id, text);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outDir = join(repoRoot, 'enrichment');
  await mkdir(outDir, { recursive: true });

  console.error('Selecting targets + fetching articles…');
  const bundles = await selectTargets(args);
  console.error(`Prepared ${bundles.length} taxon article(s).`);
  if (bundles.length === 0) return;

  const requests = buildBatchRequests(bundles, args.model);

  if (args.dryRun) {
    // Write outside enrichment/ — that dir is the cache and every *.json in it is
    // validated at build time, so a preview payload there would break the build.
    const payloadPath = join(repoRoot, 'enrich-batch-preview.json');
    await writeFile(payloadPath, JSON.stringify({ model: args.model, requests }, null, 2));
    console.error(
      `Dry run: wrote ${requests.length} request(s) → ${payloadPath}. No API call made.`,
    );
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      'ANTHROPIC_API_KEY is not set. Set it to run Engine B, or pass --dry-run to build the batch payload without calling the API.',
    );
    process.exitCode = 1;
    return;
  }

  const replies = await runBatch(requests, apiKey, args.maxWaitMin);
  const byCustomId = new Map(bundles.map((b) => [toCustomId(b.taxonId), b]));

  let written = 0;
  let invalid = 0;
  for (const [customId, text] of replies) {
    const bundle = byCustomId.get(customId);
    if (!bundle) continue;
    let entry;
    try {
      entry = toCacheEntry(bundle, parseRecordText(text));
    } catch (err) {
      console.error(`! ${bundle.taxonName}: parse failed — ${String(err)}`);
      invalid++;
      continue;
    }
    const check = validateCacheEntry(entry);
    if (!check.ok) {
      console.error(`! ${bundle.taxonName}: invalid record — ${check.errors.join('; ')}`);
      invalid++;
      continue;
    }
    const file = join(outDir, `${bundle.taxonId.replace(/:/g, '_')}.json`);
    await writeFile(file, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
    written++;
  }
  console.error(`Engine B: wrote ${written} record(s), ${invalid} rejected.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
