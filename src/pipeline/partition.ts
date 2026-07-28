/**
 * Stage-partitioned delivery (SPEC-008 REQ-005; realizes SPEC-002 REQ-006). A
 * pure transform from the single SPEC-001 read model into the artifacts the app
 * actually fetches: one shared **reference** document (metadata + sources + taxa
 * + profiles), one **per-stage** document ({ occurrences }) for each stage that
 * holds occurrences, and a small **index** the app loads at boot to discover
 * per-stage data + basemap URLs, Ma bounds, and counts.
 *
 * Only occurrences are partitioned; reference data is shared so it is not
 * duplicated across ~30 stages. An occurrence whose time range straddles a stage
 * boundary appears in each overlapped stage's partition (keyed by id, so the
 * visible total never double-counts). Deterministic: every array is sorted by a
 * stable key so a rebuild is byte-stable (NFR-002).
 */

import {
  MESOZOIC_STAGES,
  stageSlug,
  stagesInRange,
} from '../domain/index.js';
import type {
  EnrichmentRecord,
  GeologicalStage,
  ReadModel,
  ReadOccurrence,
  Source,
  SnapshotMetadata,
} from '../domain/index.js';

/**
 * Enrichment split out of the reference (SPEC-014 AMEND-004): a `taxonId →
 * record` map served as its own artifact so the reference stays small and
 * enrichment can scale to every genus without breaching the reference budget.
 */
export type EnrichmentMap = Record<string, EnrichmentRecord>;

/** The shared reference artifact — everything except occurrences. */
export interface ReferenceModel {
  metadata: SnapshotMetadata;
  sources: Record<string, Source>;
  taxa: ReadModel['taxa'];
  profiles: ReadModel['profiles'];
}

/** One stage's occurrence partition. */
export interface StagePartition {
  slug: string;
  occurrences: ReadOccurrence[];
}

/** An index entry describing one stage the app can step to. */
export interface AtlasStageEntry {
  name: string;
  slug: string;
  period: string;
  periodColour: string;
  /** Older bound, larger Ma. */
  startMa: number;
  /** Younger bound, smaller Ma. */
  endMa: number;
  occurrenceCount: number;
  /** Per-stage data URL, or null when the stage has no occurrences. */
  dataUrl: string | null;
  /** Convention path to this stage's basemap frame (resolved at runtime). */
  basemapUrl: string;
  basemapMetaUrl: string;
  /** True for the most-populated stage in its period (the quick-select target). */
  representative: boolean;
}

/** The boot index the app fetches first (SPEC-008 REQ-005). */
export interface AtlasIndex {
  metadata: SnapshotMetadata;
  referenceUrl: string;
  /** URL of the enrichment map artifact (SPEC-014 AMEND-004). */
  enrichmentUrl: string;
  stages: AtlasStageEntry[];
}

/** The full set of artifacts a build emits. */
export interface AtlasPartition {
  index: AtlasIndex;
  reference: ReferenceModel;
  /** Enrichment split out of the reference (SPEC-014 AMEND-004). */
  enrichment: EnrichmentMap;
  /** Only stages that hold ≥1 occurrence get a data file. */
  stages: StagePartition[];
}

const DATA_DIR = 'data';
const BASEMAP_DIR = 'basemap';

/** Occurrences whose known time range overlaps a stage (SPEC-008 REQ-002/005). */
export function occurrencesInStage(
  occurrences: readonly ReadOccurrence[],
  stage: GeologicalStage,
): ReadOccurrence[] {
  return occurrences.filter((o) => {
    const range = o.timeRange.value;
    if (!range) return false; // undatable occurrences have no place in a time step
    return stagesInRange(range.minMa, range.maxMa).some((s) => s.name === stage.name);
  });
}

/**
 * Partition a read model by stage. `stages` defaults to the full Mesozoic table.
 */
export function partitionReadModel(
  model: ReadModel,
  stages: readonly GeologicalStage[] = MESOZOIC_STAGES,
): AtlasPartition {
  // Split enrichment out of the reference (SPEC-014 AMEND-004): collect it into
  // its own map, and null it on the served profiles so the reference stays small.
  const enrichment: EnrichmentMap = {};
  const profiles = model.profiles.map((p) => {
    if (p.enrichment) enrichment[p.taxonId] = p.enrichment;
    return p.enrichment ? { ...p, enrichment: null } : p;
  });

  const reference: ReferenceModel = {
    metadata: model.metadata,
    sources: model.sources,
    taxa: model.taxa,
    profiles,
  };

  const partitions: StagePartition[] = [];
  const counts = new Map<string, number>();
  for (const stage of stages) {
    const occ = occurrencesInStage(model.occurrences, stage);
    counts.set(stage.name, occ.length);
    if (occ.length > 0) {
      partitions.push({ slug: stageSlug(stage.name), occurrences: occ });
    }
  }

  const representatives = pickRepresentativeStages(stages, counts);

  const entries: AtlasStageEntry[] = stages.map((stage) => {
    const slug = stageSlug(stage.name);
    const count = counts.get(stage.name) ?? 0;
    return {
      name: stage.name,
      slug,
      period: stage.period,
      periodColour: stage.periodColour,
      startMa: stage.startMa,
      endMa: stage.endMa,
      occurrenceCount: count,
      dataUrl: count > 0 ? `${DATA_DIR}/stage-${slug}.json` : null,
      basemapUrl: `${BASEMAP_DIR}/${slug}.geojson`,
      basemapMetaUrl: `${BASEMAP_DIR}/${slug}.meta.json`,
      representative: representatives.has(stage.name),
    };
  });

  return {
    index: {
      metadata: model.metadata,
      referenceUrl: `${DATA_DIR}/reference.json`,
      enrichmentUrl: `${DATA_DIR}/enrichment.json`,
      stages: entries,
    },
    reference,
    enrichment,
    stages: partitions,
  };
}

/**
 * The most-populated stage in each period is its quick-select target (SPEC-008
 * REQ-003). Ties break toward the younger stage (later in the oldest→youngest
 * table) so a period always resolves to a single, deterministic stage.
 */
function pickRepresentativeStages(
  stages: readonly GeologicalStage[],
  counts: Map<string, number>,
): Set<string> {
  const best = new Map<string, GeologicalStage>();
  for (const stage of stages) {
    const current = best.get(stage.period);
    const count = counts.get(stage.name) ?? 0;
    const currentCount = current ? (counts.get(current.name) ?? 0) : -1;
    // `>=` lets a later (younger) stage win ties, since we iterate oldest→youngest.
    if (!current || count >= currentCount) best.set(stage.period, stage);
  }
  return new Set([...best.values()].map((s) => s.name));
}
