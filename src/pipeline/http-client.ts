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

import type { ImageType, SnapshotMetadata } from '../domain/index.js';
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
/** Longest-edge width (px) requested for the renderable lead thumbnail (SPEC-012 REQ-002). */
const COMMONS_THUMB_WIDTH = 320;
/**
 * Candidate files fetched + classified per taxon before slotting (SPEC-014
 * AMEND-001). The gallery itself keeps at most one image per semantic role, but
 * we gather a wider pool so the best restoration/fossil can be chosen.
 */
const CANDIDATE_MAX = 24;
/** Commons file titles we treat as gallery-worthy raster images. */
const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp)$/i;

// Role classification (SPEC-014 AMEND-001). A Commons candidate is slotted into a
// semantic role from its categories → filename → description. Order matters:
// exclusion first, then fossil (more specific), then restoration.
// Off-topic or non-photographic files that must never fill a photo slot — incl.
// size/scale diagrams (the size comparison is the synthesized hero, not scraped)
// and non-scientific art (cartoons, memes, stamps, toys).
const EXCLUDE_RE =
  /\b(sign|signage|logo|map|stamp|coin|book|cover|golf|footprint|track|ichnite|locator|distribution|postage|banknote|plaque|mural|scale|size|cartoon|comic|humou?r|humorous|meme|caricature|toy|lego|plush)\b/i;
const FOSSIL_RE =
  /\b(skeletons?|skeletal|skulls?|holotypes?|fossils?|mount(?:ed|s)?|specimens?|bones?|teeth|tooth|casts?|vertebrae?|femur|jaws?|braincase)\b/i;
const RESTORATION_RE =
  /\b(restorations?|reconstructions?|life\s*restorations?|palaeoart|paleoart|artists?|artwork|illustrations?)\b/i;
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
  rnk?: string | number; // PBDB rank: name ("genus") or numeric code (5 = genus)
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
  image?: { value: string };
  commonscat?: { value: string };
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
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
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

    // Gallery candidates (SPEC-014 REQ-003 / AMEND-001): pool files from Wikidata
    // P18 (curated), the Wikipedia pageimage, and the Commons category (files +
    // role-named subcategories), normalise their titles, dedupe per taxon, then
    // classify + slot each taxon into one restoration + one fossil image.
    const norm = (
      f: { qid: string; file: string; roleHint?: ImageType },
      source: GalleryFile['source'],
    ): GalleryFile => ({
      qid: f.qid,
      file: normalizeCommonsTitle(f.file),
      source,
      ...(f.roleHint ? { roleHint: f.roleHint } : {}),
    });
    const p18Files = wikidata.flatMap((b) =>
      b.image ? [norm({ qid: b.qid, file: b.image }, 'p18')] : [],
    );
    const categoryFiles = (await this.commonsCategoryFiles(wikidata)).map((f) =>
      norm(f, 'category'),
    );
    // First-seen order (P18 → pageimage → category) is also the source priority,
    // so dedupe keeps the most-curated instance of a file that appears twice.
    const galleryFiles = capFilesPerQid(
      [
        ...p18Files,
        ...imageFiles.map((f) => norm(f, 'pageimage')),
        ...categoryFiles,
      ],
      CANDIDATE_MAX,
    );

    const taxonByQid = new Map(wikidata.map((b) => [b.qid, b.pbdbTaxonId]));
    const candidates = await this.commonsImages(galleryFiles, taxonByQid);
    const images = selectGallerySlots(candidates);
    this.log(
      `Commons: ${candidates.length} classified candidate(s) → ${images.length} slotted gallery image(s)`,
    );

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
        `SELECT ?name ?item ?article ?common ?image ?commonscat WHERE { ` +
        `VALUES ?name { ${values} } ` +
        `?item wdt:P225 ?name ; wdt:P31/wdt:P279* wd:Q16521 . ` +
        `?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . ` +
        `OPTIONAL { ?item wdt:P1843 ?common FILTER(LANG(?common)="en") } ` +
        `OPTIONAL { ?item wdt:P18 ?image } ` +
        `OPTIONAL { ?item wdt:P373 ?commonscat } }`;
      const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;
      let data: { results: { bindings: SparqlBinding[] } };
      try {
        data = await getJson<{ results: { bindings: SparqlBinding[] } }>(url);
      } catch (err) {
        // The P18/P373 OPTIONALs make the query heavier; a batch that times out
        // must not abort the whole crawl.
        this.log(`  ! wikidata batch failed, skipping: ${String(err)}`);
        continue;
      }
      const seen = new Set<string>();
      for (const b of data.results?.bindings ?? []) {
        const name = b.name.value;
        const pbdbTaxonId = taxonIdByName.get(name);
        if (!pbdbTaxonId || seen.has(name)) continue; // first article per taxon
        seen.add(name);
        // P18 is a Special:FilePath URL; the file name is its last, decoded segment.
        const image = b.image
          ? decodeURIComponent(b.image.value.split('/').pop()!)
          : undefined;
        out.push({
          qid: b.item.value.split('/').pop()!,
          pbdbTaxonId,
          enwikiTitle: decodeURIComponent(b.article.value.split('/wiki/').pop()!).replace(/_/g, ' '),
          enwikiUrl: b.article.value,
          ...(b.common ? { commonName: b.common.value } : {}),
          ...(image ? { image } : {}),
          ...(b.commonscat ? { commonsCategory: b.commonscat.value } : {}),
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
      try {
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
      } catch (err) {
        // A transient failure on one batch must not abort the whole crawl.
        this.log(`  ! wikipedia batch failed, skipping: ${String(err)}`);
      }
    }
    return { wikipedia, imageFiles };
  }

  /**
   * Extra gallery candidates from each taxon's Wikimedia Commons category
   * (SPEC-014 REQ-003 / AMEND-001): one `categorymembers` query per taxon with a
   * P373 category returning direct file members *and* subcategories, then a
   * bounded expansion of the role-named subcategories ("Skeletons of X", "Life
   * restorations of X") where the best fossil/restoration usually live. Best-
   * effort — a missing/empty category yields none; paced for the Commons API.
   */
  private async commonsCategoryFiles(
    bindings: RawWikidataBinding[],
  ): Promise<Array<{ qid: string; file: string }>> {
    const out: Array<{ qid: string; file: string; roleHint?: ImageType }> = [];
    const withCat = bindings.filter((b) => b.commonsCategory);
    const pushFiles = (
      qid: string,
      members: string[],
      roleHint?: ImageType,
    ): void => {
      for (const m of members) {
        const file = m.replace(/^File:/, '');
        if (m.startsWith('File:') && IMAGE_FILE_RE.test(file)) {
          out.push({ qid, file, ...(roleHint ? { roleHint } : {}) });
        }
      }
    };
    for (const b of withCat) {
      // Role-named subcategories ("X life restorations", "X skeletons") are the
      // curated home of the best fossil/restoration, so gather them FIRST — a
      // busy parent's alphabetical direct files would otherwise fill the per-taxon
      // candidate budget and starve these. Membership is a curator-provided role
      // signal, so files inherit it as a hint. Direct parent files come after.
      await sleep(60); // gentle pacing across many per-taxon queries
      const subcats = await this.categoryMembers(b.commonsCategory!, 'subcat');
      const role = (re: RegExp): string[] =>
        subcats
          .filter((m) => re.test(m.replace(/^Category:/, '')))
          .slice(0, 2);
      const hinted: Array<[string, ImageType]> = [
        ...role(RESTORATION_RE).map((s): [string, ImageType] => [
          s,
          'ArtisticReconstruction',
        ]),
        ...role(FOSSIL_RE).map((s): [string, ImageType] => [s, 'FossilPhoto']),
      ];
      for (const [sub, hint] of hinted) {
        await sleep(60);
        pushFiles(
          b.qid,
          await this.categoryMembers(sub.replace(/^Category:/, ''), 'file'),
          hint,
        );
      }
      await sleep(60);
      pushFiles(b.qid, await this.categoryMembers(b.commonsCategory!, 'file'));
    }
    return out;
  }

  /** One `categorymembers` query; returns member titles (File:/Category: prefixed). */
  private async categoryMembers(
    category: string,
    cmtype: 'file' | 'subcat' | 'file|subcat',
  ): Promise<string[]> {
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2` +
      `&list=categorymembers&cmtype=${encodeURIComponent(cmtype)}&cmlimit=30` +
      `&cmtitle=${encodeURIComponent(`Category:${category}`)}`;
    try {
      const data = await getJson<{
        query?: { categorymembers?: Array<{ title: string }> };
      }>(url);
      return (data.query?.categorymembers ?? []).map((m) => m.title);
    } catch {
      return []; // best-effort — skip a category that fails
    }
  }

  /**
   * Fetch Commons imageinfo (thumbnail + attribution + dimensions + categories)
   * for the candidate files and classify each into a semantic role (SPEC-014
   * AMEND-001). Returns showable, role-tagged, resolution-scored candidates;
   * `selectGallerySlots` then picks one per role.
   */
  private async commonsImages(
    files: GalleryFile[],
    taxonByQid: Map<string, string>,
  ): Promise<GalleryCandidate[]> {
    const out: GalleryCandidate[] = [];
    const qidByFileTitle = new Map<string, string>();
    const sourceByFileTitle = new Map<string, GalleryFile['source']>();
    const hintByFileTitle = new Map<string, ImageType>();
    for (const f of files) {
      qidByFileTitle.set(`File:${f.file}`, f.qid);
      sourceByFileTitle.set(`File:${f.file}`, f.source);
      if (f.roleHint) hintByFileTitle.set(`File:${f.file}`, f.roleHint);
    }

    for (const batch of chunk(files, 50)) {
      const titles = batch.map((f) => `File:${f.file}`).join('|');
      const url =
        `${COMMONS_API}?action=query&format=json&formatversion=2` +
        `&prop=imageinfo&iiprop=extmetadata|url|size&iiurlwidth=${COMMONS_THUMB_WIDTH}` +
        `&titles=${encodeURIComponent(titles)}`;
      try {
        const data = await getJson<CommonsResponse>(url);
        const resolve = titleResolver(data.query?.normalized, undefined);
        for (const page of data.query?.pages ?? []) {
          const info = page.imageinfo?.[0];
          if (!info) continue;
          const title = resolve(page.title);
          const qid = qidByFileTitle.get(title) ?? qidByFileTitle.get(page.title);
          const taxonId = qid ? taxonByQid.get(qid) : undefined;
          if (!taxonId) continue;
          const em = info.extmetadata ?? {};
          const credit = stripHtml(em.Artist?.value);
          const licence = em.LicenseShortName?.value ?? null;
          // Only images that can be honoured with a credit are gallery-worthy.
          if (!credit || !licence) continue;
          const source =
            sourceByFileTitle.get(title) ?? sourceByFileTitle.get(page.title);
          const isP18 = source === 'p18';
          // A lead image (P18 or the Wikipedia pageimage) is, for an extinct
          // taxon, almost always a life restoration — default it to one.
          const isLead = isP18 || source === 'pageimage';
          const subcatRole =
            hintByFileTitle.get(title) ?? hintByFileTitle.get(page.title);
          const role = classifyRole({
            file: title.replace(/^File:/, ''),
            categories: em.Categories?.value ?? '',
            description: stripHtml(em.ImageDescription?.value) ?? '',
            isLead,
            ...(subcatRole ? { subcatRole } : {}),
          });
          if (!role) continue; // excluded (signage, maps, footprints, …)
          out.push({
            taxonId,
            role,
            isP18,
            area: (info.width ?? 0) * (info.height ?? 0),
            title: title.replace(/^File:/, ''),
            asset: {
              taxonId,
              type: role,
              credit,
              licence,
              imageUrl: info.thumburl ?? info.url ?? '',
              sourceUrl: info.descriptionurl ?? page.title,
            },
          });
        }
      } catch (err) {
        this.log(`  ! commons batch failed, skipping: ${String(err)}`);
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
/** A gallery-candidate Commons file, keyed to its taxon's Wikidata QID. */
export interface GalleryFile {
  qid: string;
  file: string;
  /** Where the candidate came from — also its curation priority for dedupe/lead. */
  source: 'p18' | 'pageimage' | 'category';
  /** Role implied by the role-named subcategory the file was gathered from. */
  roleHint?: ImageType;
}

/**
 * Dedup gallery-candidate files per taxon (by qid) on normalised file title,
 * preserving first-seen order (P18 → pageimage → category), and cap each taxon
 * at `max` candidates before classification (SPEC-014 REQ-003 / AMEND-001). Pure
 * and generic so callers keep their per-file metadata (e.g. the P18 flag).
 */
export function capFilesPerQid<T extends { qid: string; file: string }>(
  files: readonly T[],
  max: number,
): T[] {
  const perQid = new Map<string, Set<string>>();
  const out: T[] = [];
  for (const f of files) {
    let seen = perQid.get(f.qid);
    if (!seen) {
      seen = new Set<string>();
      perQid.set(f.qid, seen);
    }
    if (seen.has(f.file) || seen.size >= max) continue;
    seen.add(f.file);
    out.push(f);
  }
  return out;
}

/**
 * A Commons candidate after imageinfo fetch + role classification (SPEC-014
 * AMEND-001): the ready-to-store asset plus the fields `selectGallerySlots`
 * ranks on (role, whether it is the curated P18 lead, pixel area, title).
 */
export interface GalleryCandidate {
  taxonId: string;
  role: ImageType;
  isP18: boolean;
  area: number;
  title: string;
  asset: RawImageAsset;
}

/**
 * Normalise a Commons file title so the same file arriving under different
 * spellings collapses to one (SPEC-014 AMEND-001): MediaWiki treats spaces and
 * underscores as equivalent and upper-cases the first title character, so P18's
 * `Foo_Bar.jpg` and a category listing's `Foo Bar.jpg` are the same file.
 */
export function normalizeCommonsTitle(file: string): string {
  const t = file.replace(/^File:/i, '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Classify a Commons candidate into a semantic gallery role from its categories
 * → filename → description (SPEC-014 AMEND-001). Off-topic files (signage, maps,
 * footprints, …) return `null` and are dropped. A lead image (Wikidata P18 or the
 * Wikipedia pageimage) defaults to an artistic reconstruction unless it clearly
 * reads as a fossil — for extinct taxa the lead is almost always a life restoration.
 */
export function classifyRole(input: {
  file: string;
  categories: string;
  description: string;
  isLead: boolean;
  /** Role of the role-named subcategory the file was gathered from, if any. */
  subcatRole?: ImageType;
}): ImageType | null {
  const hay = `${input.file} ${input.categories} ${input.description}`;
  // Exclusion wins first: a size chart or a "Humorous paleoart" cartoon must be
  // dropped even though it also matches an art keyword.
  if (EXCLUDE_RE.test(hay)) return null;
  if (FOSSIL_RE.test(hay)) return 'FossilPhoto';
  if (RESTORATION_RE.test(hay)) return 'ArtisticReconstruction';
  // Trust the curator: a file pulled from an "X skeletons" / "X life
  // restorations" subcategory takes that role even without a keyword of its own.
  if (input.subcatRole) return input.subcatRole;
  if (input.isLead) return 'ArtisticReconstruction';
  return null;
}

/**
 * Slot classified candidates into the per-taxon gallery (SPEC-014 AMEND-001):
 * one restoration (P18 wins, else largest) then one fossil (largest), in that
 * display order. Deterministic — ties break on title — so rebuilds are stable
 * (NFR). The size-vs-human hero is the synthesized third slot (rendered in the
 * UI from body length), so it is not sourced here.
 */
export function selectGallerySlots(
  candidates: readonly GalleryCandidate[],
): RawImageAsset[] {
  const byTaxon = new Map<string, GalleryCandidate[]>();
  for (const c of candidates) {
    const list = byTaxon.get(c.taxonId) ?? [];
    list.push(c);
    byTaxon.set(c.taxonId, list);
  }
  const best = (
    pool: GalleryCandidate[],
    role: ImageType,
    preferP18: boolean,
  ): GalleryCandidate | undefined =>
    pool
      .filter((c) => c.role === role)
      .sort(
        (a, b) =>
          (preferP18 ? Number(b.isP18) - Number(a.isP18) : 0) ||
          b.area - a.area ||
          a.title.localeCompare(b.title),
      )[0];

  const out: RawImageAsset[] = [];
  for (const taxonId of [...byTaxon.keys()].sort()) {
    const pool = byTaxon.get(taxonId)!;
    const restoration = best(pool, 'ArtisticReconstruction', true);
    const fossil = best(pool, 'FossilPhoto', false);
    if (restoration) out.push(restoration.asset);
    if (fossil) out.push(fossil.asset);
  }
  return out;
}

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
 * Map a PBDB rank to the domain's four-value rank (SPEC-010 DATA-003). PBDB returns
 * `rnk` as a **name** ("genus") from some endpoints and a **numeric rank code**
 * (5 = genus, 9 = family, 3 = species, …) from others, so both forms are handled.
 * Genus and Family map directly; species/subgenus collapse to their obvious tier;
 * every rank **above** family (superfamily, order, suborder, unranked clade, …)
 * maps to `Clade` — the "Major group" tier space. The app's tier resolver then
 * finds the true Family by rank and the Major group by a curated clade-name set, so
 * the intermediate `Clade` nodes are inert chain links, not selectable tiers.
 */
export function mapPbdbRank(
  rnk: string | number | undefined,
): RawPbdbTaxon['rank'] {
  // Numeric PBDB rank codes (2 subspecies, 3 species, 4 subgenus, 5 genus,
  // 9 family; everything else is above family → Clade).
  if (typeof rnk === 'number') {
    if (rnk === 2 || rnk === 3) return 'Species';
    if (rnk === 4 || rnk === 5) return 'Genus';
    if (rnk === 9) return 'Family';
    return 'Clade';
  }
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
