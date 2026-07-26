/**
 * Derive the L2+L3 read model from an L1 snapshot (SPEC-001 §3, design §4–8).
 * A pure function of L1: accepted validity, the four display flags, per-taxon
 * time ranges, content level, and shown images. Deterministic — every output
 * array is sorted by a stable key so a rebuild is byte-stable (NFR-001).
 */

import {
  acceptedOpinion,
  deriveContentLevel,
  deriveProvenanceView,
  isShowable,
  spansMultipleStages,
} from '../domain/index.js';
import type {
  ImageType,
  ModernPosition,
  PaleogeographicPosition,
  Provenanced,
  ReadAttribute,
  ReadImage,
  ReadMeasurement,
  ReadModel,
  ReadOccurrence,
  ReadProfile,
  ReadTaxon,
  Source,
  TimeRange,
} from '../domain/index.js';
import type { L1Snapshot } from './ingest.js';

// Gallery display order (SPEC-014 AMEND-001): the life restoration leads, then
// the fossil; skeletal mounts and silhouettes trail.
const IMAGE_TYPE_ORDER: Readonly<Record<ImageType, number>> = {
  ArtisticReconstruction: 0,
  FossilPhoto: 1,
  SkeletalMount: 2,
  Silhouette: 3,
};

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function derive(l1: L1Snapshot): ReadModel {
  const sourceMap = new Map(l1.sources.map((s) => [s.id, s]));

  // --- Taxa: winning opinion → accepted validity (DATA-002) ---
  const taxa: ReadTaxon[] = l1.taxa
    .map((t): ReadTaxon => {
      const opinions = l1.opinionsByTaxon.get(t.id) ?? [];
      const accepted = acceptedOpinion(opinions);
      if (!accepted) {
        return {
          id: t.id,
          scientificName: t.scientificName,
          rank: t.rank,
          ...(t.parentId ? { parentId: t.parentId } : {}),
          validity: {
            value: null,
            sourceId: null,
            editorial: false,
            provenance: deriveProvenanceView({ value: null }),
          },
          acceptedPer: null,
        };
      }
      const source = sourceMap.get(accepted.opinion.sourceId)!;
      const validity: ReadTaxon['validity'] = {
        value: accepted.status,
        sourceId: source.id,
        editorial: false,
        provenance: deriveProvenanceView({ value: accepted.status }),
      };
      return {
        id: t.id,
        scientificName: t.scientificName,
        rank: t.rank,
        ...(t.parentId ? { parentId: t.parentId } : {}),
        validity,
        acceptedPer: source.reference,
      };
    })
    .sort(byId);

  // --- Occurrences: collection position/time with derived flags (DATA-003) ---
  const collectionMap = new Map(l1.collections.map((c) => [c.id, c]));
  const taxonNameMap = new Map(l1.taxa.map((t) => [t.id, t.scientificName]));

  const occurrences: ReadOccurrence[] = l1.occurrences
    .map((o): ReadOccurrence => {
      const ident = o.identifications[0]!;
      const c = collectionMap.get(o.collectionId)!;

      const modernPosition: Provenanced<ModernPosition> = {
        value: c.modern,
        sourceId: c.sourceId,
        editorial: false,
        provenance: deriveProvenanceView({ value: c.modern }),
      };
      const paleoPosition: Provenanced<PaleogeographicPosition> = {
        value: c.paleo,
        sourceId: c.sourceId,
        editorial: false,
        provenance: deriveProvenanceView({ value: c.paleo }),
      };
      const timeRange: Provenanced<TimeRange> = {
        value: c.timeRange,
        sourceId: c.sourceId,
        editorial: false,
        provenance: deriveProvenanceView({
          value: c.timeRange,
          approximate: spansMultipleStages(c.timeRange.minMa, c.timeRange.maxMa),
        }),
      };

      return {
        id: o.id,
        taxonId: ident.taxonId,
        taxonName: taxonNameMap.get(ident.taxonId) ?? ident.taxonAsRecorded,
        collectionId: o.collectionId,
        collectionName: c.name,
        formation: c.formation,
        member: c.member,
        modernPosition,
        paleoPosition,
        timeRange,
      };
    })
    .sort(byId);

  // --- Per-taxon occurrence aggregates (SPEC-008 AMEND-001) ---
  // Precomputed from the built occurrences so a stage-partitioned profile can
  // report the taxon's whole-snapshot time span + total count without loading
  // every stage. Deterministic (a pure fold over the sorted occurrences).
  const occAggByTaxon = new Map<
    string,
    { minMa: number; maxMa: number; approximate: boolean; count: number }
  >();
  for (const o of occurrences) {
    const agg = occAggByTaxon.get(o.taxonId) ?? {
      minMa: Infinity,
      maxMa: -Infinity,
      approximate: false,
      count: 0,
    };
    agg.count += 1;
    const r = o.timeRange.value;
    if (r) {
      agg.minMa = Math.min(agg.minMa, r.minMa);
      agg.maxMa = Math.max(agg.maxMa, r.maxMa);
    }
    if (o.timeRange.provenance.approximate) agg.approximate = true;
    occAggByTaxon.set(o.taxonId, agg);
  }

  // --- Profiles: biology (typed, sourced) + content level + shown images ---
  const encByTaxon = new Map(l1.encyclopedic.map((e) => [e.taxonId, e]));
  const editorialByTaxon = new Map(l1.editorial.map((e) => [e.taxonId, e.item]));

  const profiles: ReadProfile[] = l1.taxa
    .map((t): ReadProfile => {
      const enc = encByTaxon.get(t.id) ?? null;

      const summary: Provenanced<string> | null = enc && enc.summary !== null
        ? {
            value: enc.summary,
            sourceId: enc.articleSourceId,
            editorial: false,
            provenance: deriveProvenanceView({ value: enc.summary }),
          }
        : null;

      const commonName: Provenanced<string> | null = enc && enc.commonName !== null
        ? {
            value: enc.commonName,
            sourceId: enc.articleSourceId,
            editorial: false,
            provenance: deriveProvenanceView({ value: enc.commonName }),
          }
        : null;

      const attributes: ReadAttribute[] = l1.attributes
        .filter((a) => a.taxonId === t.id)
        .map((a): ReadAttribute => ({
          kind: a.item.kind,
          value: {
            value: a.item.assertion.value,
            sourceId: a.item.assertion.sourceId,
            editorial: false,
            provenance: deriveProvenanceView({ value: a.item.assertion.value }),
          },
        }))
        .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));

      const measurements: ReadMeasurement[] = l1.measurements
        .filter((m) => m.taxonId === t.id)
        .map((m): ReadMeasurement => ({
          kind: m.item.kind,
          unit: m.item.unit,
          lowerBound: m.item.lowerBound,
          upperBound: m.item.upperBound,
          value: {
            value: m.item.value,
            sourceId: m.item.assertion.sourceId,
            editorial: false,
            provenance: deriveProvenanceView({ value: m.item.value }),
          },
        }))
        .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));

      // DATA-007: only images whose licence can be honoured with a credit.
      // Order by semantic slot (life restoration leads, then fossil — SPEC-014
      // AMEND-001), then by sourceUrl within a slot so rebuilds stay deterministic.
      const images: ReadImage[] = l1.images
        .filter((img) => img.taxonId === t.id && isShowable(img.item))
        .map((img): ReadImage => ({
          type: img.item.type,
          credit: img.item.credit!,
          licence: img.item.licence!,
          imageUrl: img.item.imageUrl,
          sourceUrl: img.item.sourceUrl,
          sourceId: img.item.sourceId,
        }))
        .sort(
          (a, b) =>
            IMAGE_TYPE_ORDER[a.type] - IMAGE_TYPE_ORDER[b.type] ||
            (a.sourceUrl < b.sourceUrl ? -1 : a.sourceUrl > b.sourceUrl ? 1 : 0),
        );

      const contentLevel = deriveContentLevel({
        hasSummary: summary !== null,
        attributeCount: attributes.length,
        measurementCount: measurements.filter((m) => m.value.value !== null).length,
        imageCount: images.length,
        featured: editorialByTaxon.has(t.id),
      });

      const agg = occAggByTaxon.get(t.id);
      const timeSpan =
        agg && Number.isFinite(agg.minMa)
          ? { minMa: agg.minMa, maxMa: agg.maxMa }
          : null;

      return {
        taxonId: t.id,
        contentLevel,
        summary,
        commonName,
        attributes,
        measurements,
        images,
        occurrenceCount: agg?.count ?? 0,
        timeSpan,
        timeSpanApproximate: agg?.approximate ?? false,
      };
    })
    .sort((a, b) => (a.taxonId < b.taxonId ? -1 : a.taxonId > b.taxonId ? 1 : 0));

  const sources: Record<string, Source> = {};
  for (const s of [...l1.sources].sort(byId)) {
    sources[s.id] = s;
  }

  return { metadata: l1.metadata, sources, taxa, occurrences, profiles };
}
