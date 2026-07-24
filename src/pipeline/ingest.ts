/**
 * Ingest raw source records into an L1 snapshot (SPEC-001 §3, design §9): typed
 * `Source`s, taxa/opinions, collections/occurrences, measurements/attributes,
 * and the encyclopedic layer joined to taxa by Wikidata QID (DATA-004). L1 is a
 * faithful, sourced mirror of the subset — no derivation happens here.
 */

import type {
  BiologyAttribute,
  Collection,
  EditorialSummary,
  FossilOccurrence,
  ImageAsset,
  Measurement,
  Source,
  Taxon,
  TaxonomicOpinion,
} from '../domain/index.js';
import type { SnapshotMetadata } from '../domain/index.js';
import type { SourceSubset } from './sources.js';

export interface EncyclopedicEntry {
  taxonId: string;
  qid: string;
  articleSourceId: string;
  summary: string | null;
  commonName: string | null;
}

export interface WithTaxon<T> {
  taxonId: string;
  item: T;
}

export interface L1Snapshot {
  metadata: SnapshotMetadata;
  sources: Source[];
  taxa: Taxon[];
  opinionsByTaxon: Map<string, TaxonomicOpinion[]>;
  collections: Collection[];
  occurrences: FossilOccurrence[];
  measurements: Array<WithTaxon<Measurement>>;
  attributes: Array<WithTaxon<BiologyAttribute>>;
  encyclopedic: EncyclopedicEntry[];
  images: Array<WithTaxon<ImageAsset>>;
  editorial: Array<WithTaxon<EditorialSummary>>;
}

const PBDB_SOURCE_ID = 'src:pbdb';

function articleSourceId(qid: string): string {
  return `src:wp:${qid}`;
}

function editorialSourceId(taxonId: string): string {
  return `src:ed:${taxonId}`;
}

/**
 * Normalise a Wikipedia lead extract so a pronunciation-only or empty leading
 * parenthetical does not survive as a dangling fragment (SPEC-011 REQ-003).
 * When the IPA glyph is absent from the extract, "Name (/ipa/; meaning …)"
 * arrives as "Name (; meaning …)"; strip the dangling "; " so it reads
 * "Name (meaning …)", and drop any parenthetical left entirely empty. A
 * well-formed parenthetical (IPA present, or plain text) is left untouched.
 */
export function cleanSummary(text: string | null): string | null {
  if (text === null) return null;
  const out = text
    // "(; meaning …" → "(meaning …"; "(;)" → "()".
    .replace(/\(\s*;\s*/g, '(')
    // Remove any now-empty parenthetical.
    .replace(/\(\s*\)/g, '')
    // Tidy the whitespace those removals can leave behind.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:])/g, '$1')
    .trim();
  return out;
}

export function ingest(subset: SourceSubset): L1Snapshot {
  const { metadata } = subset;
  const retrievedOn = metadata.retrievedOn;
  const sources: Source[] = [];

  // The PBDB database itself — the channel every primary reference came via.
  sources.push({
    id: PBDB_SOURCE_ID,
    kind: 'Database',
    reference: 'Paleobiology Database',
    url: 'https://paleobiodb.org/',
    retrievedOn,
  });

  // Primary-literature references: resolve to their citation, obtained via PBDB.
  for (const ref of subset.references) {
    sources.push({
      id: ref.id,
      kind: 'PrimaryLiterature',
      reference: ref.reference,
      ...(ref.url ? { url: ref.url } : {}),
      retrievedOn,
      derivedFrom: PBDB_SOURCE_ID,
    });
  }

  // Wikidata join (DATA-004): PBDB taxon id → Wikipedia article. Unmatched taxa
  // simply have no encyclopedic entry (graceful "not available").
  const wikipediaByQid = new Map(subset.wikipedia.map((w) => [w.qid, w]));
  const encyclopedic: EncyclopedicEntry[] = [];
  for (const binding of subset.wikidata) {
    const srcId = articleSourceId(binding.qid);
    sources.push({
      id: srcId,
      kind: 'Encyclopedic',
      reference: `Wikipedia: ${binding.enwikiTitle}`,
      url: binding.enwikiUrl,
      retrievedOn,
    });
    const summary = cleanSummary(
      wikipediaByQid.get(binding.qid)?.extract ?? null,
    );
    encyclopedic.push({
      taxonId: binding.pbdbTaxonId,
      qid: binding.qid,
      articleSourceId: srcId,
      summary,
      commonName: binding.commonName ?? null,
    });
  }
  const encyclopedicByTaxon = new Map(encyclopedic.map((e) => [e.taxonId, e]));

  // Editorial (L3) sources, attributed and chained to the encyclopedic article.
  for (const entry of subset.editorial) {
    const enc = encyclopedicByTaxon.get(entry.taxonId);
    sources.push({
      id: editorialSourceId(entry.taxonId),
      kind: 'Editorial',
      reference: 'Editorial synthesis',
      ...(enc ? { derivedFrom: enc.articleSourceId } : {}),
      retrievedOn,
    });
  }

  const taxa: Taxon[] = subset.taxa.map((t) => ({
    id: t.id,
    scientificName: t.name,
    rank: t.rank,
    ...(t.parentId ? { parentId: t.parentId } : {}),
  }));

  const opinionsByTaxon = new Map<string, TaxonomicOpinion[]>();
  for (const op of subset.opinions) {
    const list = opinionsByTaxon.get(op.taxonId) ?? [];
    list.push({ status: op.status, publishedOn: op.publishedOn, sourceId: op.referenceId });
    opinionsByTaxon.set(op.taxonId, list);
  }

  const collections: Collection[] = subset.collections.map((c) => ({
    id: c.id,
    name: c.name,
    formation: c.formation,
    member: c.member,
    modern: { lat: c.lat, lng: c.lng, region: c.region },
    paleo:
      c.palaeoLat !== null && c.palaeoLng !== null
        ? { palaeoLat: c.palaeoLat, palaeoLng: c.palaeoLng, rotationModel: metadata.rotationModel }
        : null,
    timeRange: { minMa: c.minMa, maxMa: c.maxMa },
    sourceId: c.referenceId,
  }));

  const occurrences: FossilOccurrence[] = subset.occurrences.map((o) => ({
    id: o.id,
    collectionId: o.collectionId,
    identifications: [
      {
        taxonId: o.taxonId,
        taxonAsRecorded: o.taxonAsRecorded,
        reidentified: o.reidentified,
        sourceId: o.referenceId,
      },
    ],
  }));

  const measurements: Array<WithTaxon<Measurement>> = subset.measurements.map((m) => ({
    taxonId: m.taxonId,
    item: {
      kind: m.kind,
      value: m.value,
      unit: m.unit,
      lowerBound: m.lowerBound,
      upperBound: m.upperBound,
      assertion: {
        predicate: m.kind,
        value: m.value,
        assertedOn: m.publishedOn,
        sourceId: m.referenceId,
      },
    },
  }));

  const attributes: Array<WithTaxon<BiologyAttribute>> = subset.attributes.map((a) => {
    let sourceId: string;
    switch (a.source.via) {
      case 'reference':
        sourceId = a.source.referenceId;
        break;
      case 'encyclopedic':
        sourceId = articleSourceId(a.source.qid);
        break;
      case 'editorial':
        sourceId = editorialSourceId(a.taxonId);
        break;
    }
    return {
      taxonId: a.taxonId,
      item: {
        kind: a.kind,
        assertion: { predicate: a.kind, value: a.value, assertedOn: a.assertedOn, sourceId },
      },
    };
  });

  const images: Array<WithTaxon<ImageAsset>> = subset.images.map((img) => {
    const enc = encyclopedicByTaxon.get(img.taxonId);
    return {
      taxonId: img.taxonId,
      item: {
        type: img.type,
        credit: img.credit,
        licence: img.licence,
        sourceUrl: img.sourceUrl,
        sourceId: enc ? enc.articleSourceId : PBDB_SOURCE_ID,
      },
    };
  });

  const editorial: Array<WithTaxon<EditorialSummary>> = subset.editorial.map((e) => ({
    taxonId: e.taxonId,
    item: { text: e.text, sourceId: editorialSourceId(e.taxonId) },
  }));

  return {
    metadata,
    sources,
    taxa,
    opinionsByTaxon,
    collections,
    occurrences,
    measurements,
    attributes,
    encyclopedic,
    images,
    editorial,
  };
}
