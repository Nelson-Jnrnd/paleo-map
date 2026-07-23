/**
 * Live `SourceClient` over the real upstreams (SPEC-001 DATA-004, AMEND-001): the
 * Paleobiology Database REST API (the scientific spine) plus Wikidata SPARQL and
 * the MediaWiki/Wikimedia-Commons APIs (the encyclopedic, tertiary layer). It is
 * a drop-in for the same `SourceClient` interface the fixture client implements,
 * so ingest → derive → validate → snapshot is unchanged downstream.
 *
 * This adapter runs at **ingestion (build) time only** — it never runs on the
 * app read path, so DATA-005 ("no runtime egress to PBDB/Wikipedia") still holds:
 * the app reads the dated snapshot this produces, not the network.
 *
 * Scope is a configured PBDB pull (default under SPEC-008: Dinosauria genera
 * across the whole Mesozoic — one query per period, Triassic/Jurassic/Cretaceous,
 * merged deterministically) with paleocoordinates from the pinned Scotese/PALEOMAP
 * model (`pgm=scotese`, AMEND-001). Encyclopedic content is joined to PBDB taxa via a
 * Wikidata QID discovered by taxon name (P225) — PBDB's own `P846` values on
 * Wikidata are legacy ids that no longer resolve in the current API, so the name
 * is the reliable bridge to the QID that then keys the article and image.
 */

import type { SnapshotMetadata } from '../domain/index.js';
import type {
  RawBiologyAttribute,
  RawImageAsset,
  RawPbdbCollection,
  RawPbdbOccurrence,
  RawPbdbOpinion,
  RawPbdbReference,
  RawPbdbTaxon,
  RawWikidataBinding,
  RawWikipediaSummary,
  SourceClient,
  SourceSubset,
} from './sources.js';
import type { NomenclaturalStatus } from '../domain/taxonomy.js';

const PBDB_BASE = 'https://paleobiodb.org/data1.2';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT =
  'paleo-map-ingestion/0.1 (https://github.com/Nelson-Jnrnd/paleo-map; SPEC-001 data layer)';

export interface HttpSourceOptions {
  /** PBDB `base_name` for the pull. */
  baseName: string;
  /**
   * PBDB `interval`s to pull. SPEC-008 REQ-001 issues **one query per entry** and
   * merges the results deterministically, so the full-Mesozoic default is the
   * three periods rather than a single comma-joined interval.
   */
  intervals: string[];
  /** Human name + Ma bounds recorded in snapshot metadata. */
  timeWindow: { name: string; maxMa: number; minMa: number };
  /** Pinned plate-rotation model (AMEND-001). */
  rotationModel: string;
  rotationModelVersion: string;
  /** Immutable capture date (ISO 8601). Defaults to today (the run date). */
  retrievedOn?: string;
  /** Optional structured logger; defaults to `console.log`. */
  log?: (msg: string) => void;
}

export const DEFAULT_HTTP_SOURCE_OPTIONS: HttpSourceOptions = {
  baseName: 'Dinosauria',
  // One query per Mesozoic period (SPEC-008 REQ-001) — friendlier to PBDB rate
  // limits than one giant call, and merged deterministically below.
  intervals: ['Triassic', 'Jurassic', 'Cretaceous'],
  timeWindow: { name: 'Mesozoic', maxMa: 251.902, minMa: 66.0 },
  rotationModel: 'scotese',
  rotationModelVersion: 'PALEOMAP-2016',
};

/** Compact PBDB JSON record shapes (only the fields this adapter consumes). */
interface PbdbTaxonRecord {
  oid: string;
  nam: string;
  rnk?: string; // PBDB rank name, e.g. "genus", "family", "unranked clade"
  par?: string;
  att?: string;
  rid?: string;
  tdf?: string;
  jdt?: string; // diet
  jmo?: string; // motility → locomotion
  jev?: string; // taxon environment → habitat
}

interface PbdbOccRecord {
  oid: string;
  cid?: string;
  tid?: string;
  eid?: string; // reidentification id (present ⇒ reidentified)
  tna?: string; // taxon name as accepted
  idn?: string; // identified-as name (with modifiers), when it differs
  gnl?: string; // genus name (class)
  rid?: string;
  eag?: number; // early age (older, maxMa)
  lag?: number; // late age (younger, minMa)
  lng?: number | string;
  lat?: number | string;
  pln?: number; // paleo lng
  pla?: number; // paleo lat
  pm1?: string; // paleomodel
  cnm?: string; // collection name
  sfm?: string; // formation
  smb?: string; // member
  cc2?: string; // country code
  stp?: string; // state/province
}

interface PbdbRefRecord {
  oid: string;
  ref?: string; // fully formatted citation
  pby?: string; // publication year
  doi?: string;
}

interface SparqlBinding {
  name: { value: string };
  item: { value: string };
  article: { value: string };
  common?: { value: string };
}

interface MwPage {
  title: string;
  extract?: string;
  pageimage?: string;
  missing?: boolean;
}

interface MwExtractResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    /** formatversion=2 returns pages as an array. */
    pages?: MwPage[];
  };
}

interface CommonsPage {
  title: string;
  imageinfo?: Array<{
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

interface CommonsResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: CommonsPage[];
  };
}

export class HttpSourceClient implements SourceClient {
  private readonly opts: HttpSourceOptions;
  private readonly log: (msg: string) => void;

  constructor(options: Partial<HttpSourceOptions> = {}) {
    this.opts = { ...DEFAULT_HTTP_SOURCE_OPTIONS, ...options };
    this.log = this.opts.log ?? ((m) => console.log(m));
  }

  async fetchSubset(): Promise<SourceSubset> {
    const retrievedOn = this.opts.retrievedOn ?? new Date().toISOString().slice(0, 10);
    const metadata: SnapshotMetadata = {
      retrievedOn,
      rotationModel: this.opts.rotationModel,
      rotationModelVersion: this.opts.rotationModelVersion,
      pbdbSubset: `${this.opts.baseName} occurrences, ${this.opts.timeWindow.name}`,
      timeWindow: this.opts.timeWindow,
    };

    // --- PBDB: taxa (genera + their ancestors) → taxa, opinions, attributes ---
    // SPEC-010 DATA-003: the occurrence-bearing genera plus the family/clade
    // ancestors they roll up to, each with its real rank and a resolvable parent.
    const taxonRecords = await this.pbdbTaxa();
    this.log(
      `PBDB: ${taxonRecords.length} taxa (genera + ancestors) in ${this.opts.baseName}/[${this.opts.intervals.join(', ')}]`,
    );

    const taxa: RawPbdbTaxon[] = [];
    const opinions: RawPbdbOpinion[] = [];
    const attributes: RawBiologyAttribute[] = [];
    const taxonIdByName = new Map<string, string>();
    const refIds = new Set<string>();

    for (const t of taxonRecords) {
      taxa.push({
        id: t.oid,
        name: t.nam,
        rank: mapPbdbRank(t.rnk),
        ...(t.par ? { parentId: t.par } : {}),
      });
      taxonIdByName.set(t.nam, t.oid);

      const year = parseYear(t.att);
      const assertedOn = year ? `${year}-01-01` : retrievedOn;

      if (t.rid) {
        refIds.add(t.rid);
        opinions.push({
          taxonId: t.oid,
          status: mapStatus(t.tdf),
          publishedOn: assertedOn,
          referenceId: t.rid,
        });

        // Ecospace → typed biology attributes, attributed to the taxon's PBDB
        // reference (a primary source in PBDB's own record — DATA-006).
        for (const [kind, raw] of [
          ['Diet', t.jdt],
          ['Locomotion', t.jmo],
          ['Habitat', t.jev],
        ] as const) {
          const value = cleanEcospace(raw);
          if (value) {
            attributes.push({
              taxonId: t.oid,
              kind,
              value,
              assertedOn,
              source: { via: 'reference', referenceId: t.rid },
            });
          }
        }
      }
    }

    // --- PBDB: occurrences → occurrences, collections, occurrence references ---
    const occRecords = await this.pbdbOccurrences();
    this.log(`PBDB: ${occRecords.length} occurrences (pgm=${this.opts.rotationModel})`);

    const occurrences: RawPbdbOccurrence[] = [];
    const collectionsById = new Map<string, RawPbdbCollection>();

    for (const o of occRecords) {
      if (!o.cid || !o.rid) continue; // an occurrence needs a locality + a source
      refIds.add(o.rid);

      // Resolve the occurrence to its genus taxon where we captured that genus,
      // so occurrences join to taxa/profiles; otherwise keep the identified id.
      const genusId = o.gnl ? taxonIdByName.get(o.gnl) : undefined;
      const taxonId = genusId ?? o.tid ?? o.gnl ?? 'txn:indet';

      occurrences.push({
        id: o.oid,
        collectionId: o.cid,
        taxonId,
        taxonAsRecorded: o.idn ?? o.tna ?? o.gnl ?? 'indeterminate',
        reidentified: Boolean(o.eid),
        referenceId: o.rid,
      });

      if (!collectionsById.has(o.cid)) {
        collectionsById.set(o.cid, {
          id: o.cid,
          name: o.cnm ?? o.cid,
          formation: o.sfm ?? null,
          member: o.smb ?? null,
          lat: toNum(o.lat),
          lng: toNum(o.lng),
          region: [o.stp, o.cc2].filter(Boolean).join(', ') || (o.cc2 ?? 'Unknown'),
          palaeoLat: o.pla ?? null,
          palaeoLng: o.pln ?? null,
          maxMa: o.eag ?? 0,
          minMa: o.lag ?? 0,
          referenceId: o.rid,
        });
      }
    }
    const collections = [...collectionsById.values()];

    // --- PBDB: references (full citations) for every cited reference id ---
    const references = await this.pbdbReferences([...refIds]);
    // At full-Mesozoic scale a handful of cited occurrence/collection reference
    // ids have no `refs/list` record (PBDB gaps). Backfill each with a minimal
    // citation so every `sourceId` still resolves (DATA-001) — the id is a real
    // PBDB reference, just not expandable to a full citation here.
    const resolvedRefs = new Set(references.map((r) => r.id));
    let backfilled = 0;
    for (const id of refIds) {
      if (!resolvedRefs.has(id)) {
        references.push({
          id,
          reference: `PBDB reference ${id.replace(/^ref:/, '')} (citation unavailable)`,
          pubYear: 0,
        });
        backfilled += 1;
      }
    }
    this.log(
      `PBDB: ${references.length} references (${backfilled} backfilled for integrity)`,
    );

    // --- Wikidata QID join (by taxon name) + Wikipedia extracts + Commons media ---
    const names = taxa.map((t) => t.name);
    const wikidata = await this.wikidataBindings(names, taxonIdByName);
    this.log(`Wikidata: ${wikidata.length}/${names.length} taxa matched to an enwiki article`);

    const { wikipedia, imageFiles } = await this.wikipediaExtracts(wikidata);
    this.log(`Wikipedia: ${wikipedia.length} article summaries captured`);

    const taxonByQid = new Map(wikidata.map((b) => [b.qid, b.pbdbTaxonId]));
    const images = await this.commonsImages(imageFiles, taxonByQid);
    const showable = images.filter((i) => i.licence && i.credit).length;
    this.log(`Commons: ${images.length} lead images (${showable} with licence + credit)`);

    return {
      metadata,
      references,
      taxa,
      opinions,
      collections,
      occurrences,
      measurements: [], // PBDB specimen measurements are sparse; not pulled this run.
      attributes,
      wikidata,
      wikipedia,
      images,
      editorial: [], // L3 editorial is hand-authored, not sourced live.
    };
  }

  // ---- PBDB ---------------------------------------------------------------

  /**
   * SPEC-008 REQ-001 + SPEC-010 DATA-003: one PBDB `taxa/list` query per interval
   * for the occurrence-bearing **genera**, then a walk **up** the `par` chain to
   * capture the ancestor taxa (families and higher clades) so any genus resolves
   * to a Family / Major-group ancestor inside the snapshot. All merged
   * deterministically (stable sort + first-wins de-dup by `oid`) so the result is
   * byte-stable regardless of query order (NFR-002).
   */
  private async pbdbTaxa(): Promise<PbdbTaxonRecord[]> {
    const perInterval: PbdbTaxonRecord[][] = [];
    for (const interval of this.opts.intervals) {
      const url =
        `${PBDB_BASE}/taxa/list.json?base_name=${encodeURIComponent(this.opts.baseName)}` +
        `&rank=genus&interval=${encodeURIComponent(interval)}` +
        `&show=attr,ecospace,parent&limit=100000`;
      const { records } = await getJson<{ records: PbdbTaxonRecord[] }>(url);
      perInterval.push(records ?? []);
    }
    const genera = mergeById(perInterval.flat());

    // Walk up the parent chain, fetching each unseen ancestor once, until every
    // referenced `par` is resolved (or PBDB returns nothing more). Bounded by the
    // finite depth of the tree; the requested set stops cycles/re-fetches.
    const known = new Map<string, PbdbTaxonRecord>(genera.map((t) => [t.oid, t]));
    const requested = new Set<string>();
    let frontier = new Set<string>(
      genera.flatMap((t) => (t.par && !known.has(t.par) ? [t.par] : [])),
    );
    while (frontier.size > 0) {
      // Only query ids never requested before, so a resolver that echoes known
      // records (or a broken chain) can never loop forever.
      const toFetch = [...frontier].filter((id) => !requested.has(id));
      if (toFetch.length === 0) break;
      for (const id of toFetch) requested.add(id);
      const fetched = await this.pbdbTaxaByIds(toFetch);
      if (fetched.length === 0) break;
      const next = new Set<string>();
      for (const t of fetched) {
        if (!known.has(t.oid)) known.set(t.oid, t);
        if (t.par && !known.has(t.par)) next.add(t.par);
      }
      frontier = next;
    }
    return mergeById([...known.values()]);
  }

  /** Fetch specific taxa by id (the ancestor walk in {@link pbdbTaxa}). */
  private async pbdbTaxaByIds(ids: string[]): Promise<PbdbTaxonRecord[]> {
    const out: PbdbTaxonRecord[] = [];
    const numeric = ids.map((id) => id.replace(/^txn:/, ''));
    for (const batch of chunk(numeric, 100)) {
      const url =
        `${PBDB_BASE}/taxa/list.json?taxon_id=${batch.join(',')}` +
        `&show=attr,ecospace,parent`;
      const { records } = await getJson<{ records: PbdbTaxonRecord[] }>(url);
      out.push(...(records ?? []));
    }
    return out;
  }

  /** As {@link pbdbTaxa}: one `occs/list` query per interval, merged by `oid`. */
  private async pbdbOccurrences(): Promise<PbdbOccRecord[]> {
    const perInterval: PbdbOccRecord[][] = [];
    for (const interval of this.opts.intervals) {
      const url =
        `${PBDB_BASE}/occs/list.json?base_name=${encodeURIComponent(this.opts.baseName)}` +
        `&interval=${encodeURIComponent(interval)}` +
        `&pgm=${encodeURIComponent(this.opts.rotationModel)}` +
        `&show=class,coords,paleoloc,coll,loc,strat&limit=100000`;
      const { records } = await getJson<{ records: PbdbOccRecord[] }>(url);
      perInterval.push(records ?? []);
    }
    return mergeById(perInterval.flat());
  }

  private async pbdbReferences(ids: string[]): Promise<RawPbdbReference[]> {
    const out: RawPbdbReference[] = [];
    const numeric = ids.map((id) => id.replace(/^ref:/, ''));
    for (const batch of chunk(numeric, 200)) {
      const url =
        `${PBDB_BASE}/refs/list.json?ref_id=${batch.join(',')}&show=both`;
      const { records } = await getJson<{ records: PbdbRefRecord[] }>(url);
      for (const r of records ?? []) {
        out.push({
          id: r.oid,
          reference: r.ref ?? r.oid,
          ...(r.doi ? { url: `https://doi.org/${r.doi}` } : {}),
          pubYear: r.pby ? parseInt(r.pby, 10) || 0 : 0,
        });
      }
    }
    return out;
  }

  // ---- Wikidata / Wikipedia / Commons -------------------------------------

  private async wikidataBindings(
    names: string[],
    taxonIdByName: Map<string, string>,
  ): Promise<RawWikidataBinding[]> {
    const out: RawWikidataBinding[] = [];
    // VALUES batches keep each SPARQL query well under service limits.
    for (const batch of chunk(names, 220)) {
      const values = batch.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(' ');
      const query =
        `SELECT ?name ?item ?article ?common WHERE { ` +
        `VALUES ?name { ${values} } ` +
        `?item wdt:P225 ?name ; wdt:P31/wdt:P279* wd:Q16521 . ` +
        `?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . ` +
        `OPTIONAL { ?item wdt:P1843 ?common FILTER(LANG(?common)="en") } }`;
      const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;
      const data = await getJson<{ results: { bindings: SparqlBinding[] } }>(url);
      const seen = new Set<string>();
      for (const b of data.results?.bindings ?? []) {
        const name = b.name.value;
        const pbdbTaxonId = taxonIdByName.get(name);
        if (!pbdbTaxonId || seen.has(name)) continue; // first article per taxon
        seen.add(name);
        out.push({
          qid: b.item.value.split('/').pop()!,
          pbdbTaxonId,
          enwikiTitle: decodeURIComponent(b.article.value.split('/wiki/').pop()!).replace(/_/g, ' '),
          enwikiUrl: b.article.value,
          ...(b.common ? { commonName: b.common.value } : {}),
        });
      }
    }
    return out;
  }

  private async wikipediaExtracts(
    bindings: RawWikidataBinding[],
  ): Promise<{ wikipedia: RawWikipediaSummary[]; imageFiles: Array<{ qid: string; file: string }> }> {
    const wikipedia: RawWikipediaSummary[] = [];
    const imageFiles: Array<{ qid: string; file: string }> = [];
    const byTitle = new Map<string, RawWikidataBinding>();
    for (const b of bindings) byTitle.set(b.enwikiTitle, b);

    // TextExtracts caps at 20 titles per request (`exlimit`); batch accordingly.
    for (const batch of chunk(bindings, 20)) {
      const titles = batch.map((b) => b.enwikiTitle).join('|');
      const url =
        `${ENWIKI_API}?action=query&format=json&redirects=1&formatversion=2` +
        `&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=3&exlimit=max` +
        `&piprop=name&titles=${encodeURIComponent(titles)}`;
      const data = await getJson<MwExtractResponse>(url);
      const resolve = titleResolver(data.query?.normalized, data.query?.redirects);
      for (const page of data.query?.pages ?? []) {
        if (page.missing) continue;
        const requested = resolve(page.title);
        const binding = byTitle.get(requested) ?? byTitle.get(page.title);
        if (!binding) continue;
        if (page.extract) {
          wikipedia.push({ qid: binding.qid, extract: page.extract, url: binding.enwikiUrl });
        }
        if (page.pageimage) {
          imageFiles.push({ qid: binding.qid, file: page.pageimage });
        }
      }
    }
    return { wikipedia, imageFiles };
  }

  private async commonsImages(
    files: Array<{ qid: string; file: string }>,
    taxonByQid: Map<string, string>,
  ): Promise<RawImageAsset[]> {
    const out: RawImageAsset[] = [];
    const qidByFileTitle = new Map<string, string>();
    for (const f of files) qidByFileTitle.set(`File:${f.file}`, f.qid);

    for (const batch of chunk(files, 50)) {
      const titles = batch.map((f) => `File:${f.file}`).join('|');
      const url =
        `${COMMONS_API}?action=query&format=json&formatversion=2` +
        `&prop=imageinfo&iiprop=extmetadata|url&titles=${encodeURIComponent(titles)}`;
      const data = await getJson<CommonsResponse>(url);
      const resolve = titleResolver(data.query?.normalized, undefined);
      for (const page of data.query?.pages ?? []) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        const qid = qidByFileTitle.get(resolve(page.title)) ?? qidByFileTitle.get(page.title);
        const taxonId = qid ? taxonByQid.get(qid) : undefined;
        if (!taxonId) continue;
        const em = info.extmetadata ?? {};
        out.push({
          taxonId,
          type: 'FossilPhoto',
          credit: stripHtml(em.Artist?.value),
          licence: em.LicenseShortName?.value ?? null,
          sourceUrl: info.descriptionurl ?? page.title,
        });
      }
    }
    return out;
  }
}

// ---- helpers --------------------------------------------------------------

/**
 * Deterministically merge PBDB records pulled across several per-period queries
 * (SPEC-008 REQ-001): de-duplicate by `oid` keeping the first occurrence of each
 * id, then sort by `oid` so the merged list — and every artifact derived from it
 * — is byte-stable regardless of query order (NFR-002). Pure and unit-testable.
 */
export function mergeById<T extends { oid: string }>(records: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of records) {
    if (!byId.has(r.oid)) byId.set(r.oid, r);
  }
  return [...byId.values()].sort((a, b) =>
    a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0,
  );
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt >= 4) throw err;
    await sleep(500 * 2 ** (attempt - 1));
    return getJson<T>(url, attempt + 1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toNum(v: number | string | undefined): number {
  if (v === undefined) return 0;
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

function parseYear(attribution: string | undefined): string | null {
  const m = attribution?.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return m ? m[1]! : null;
}

/**
 * Map a PBDB rank name to the domain's four-value rank (SPEC-010 DATA-003). Genus
 * and Family map directly; species/subgenus collapse to their obvious tier; every
 * rank **above** family (superfamily, order, suborder, unranked clade, …) maps to
 * `Clade` — the "Major group" tier space. The app's tier resolver then finds the
 * true Family by rank and the Major group by a curated clade-name set, so the
 * intermediate `Clade` nodes are inert chain links, not selectable tiers.
 */
function mapPbdbRank(rnk: string | undefined): RawPbdbTaxon['rank'] {
  switch ((rnk ?? '').toLowerCase()) {
    case 'species':
    case 'subspecies':
      return 'Species';
    case 'genus':
    case 'subgenus':
      return 'Genus';
    case 'family':
      return 'Family';
    default:
      return 'Clade';
  }
}

/** Map PBDB nomenclatural status text to the domain's `NomenclaturalStatus`. */
function mapStatus(tdf: string | undefined): NomenclaturalStatus {
  if (!tdf || tdf === 'belongs to') return 'Valid';
  const t = tdf.toLowerCase();
  if (t.includes('nomen dubium')) return 'Doubtful';
  if (t.includes('synonym') || t.includes('replaced by')) return 'Synonymous';
  if (
    t.includes('nomen nudum') ||
    t.includes('nomen vanum') ||
    t.includes('nomen oblitum') ||
    t.includes('invalid subgroup') ||
    t.includes('misspelling')
  ) {
    return 'Invalid';
  }
  return 'Uncertain';
}

function cleanEcospace(raw: string | undefined): string | null {
  if (!raw) return null;
  // PBDB ecospace values can be comma-lists ("browser,grazer"); take the first.
  const first = raw.split(',')[0]!.trim();
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text || null;
}

/** Chain MediaWiki `normalized`/`redirects` maps: final page title → requested. */
function titleResolver(
  normalized: Array<{ from: string; to: string }> | undefined,
  redirects: Array<{ from: string; to: string }> | undefined,
): (finalTitle: string) => string {
  const reverse = new Map<string, string>();
  for (const r of redirects ?? []) reverse.set(r.to, r.from);
  for (const n of normalized ?? []) reverse.set(n.to, n.from);
  return (finalTitle: string) => {
    let cur = finalTitle;
    // Walk back at most twice (normalize → redirect).
    for (let i = 0; i < 3; i++) {
      const prev = reverse.get(cur);
      if (prev === undefined) break;
      cur = prev;
    }
    return cur;
  };
}
