/**
 * Read API (SPEC-001 DATA-005). Serves the L2+L3 read model from our own store
 * (an in-memory snapshot loaded from a static artifact). It performs no network
 * I/O and never calls PBDB/Wikipedia — the snapshot is the only data source.
 * In-memory filtering over the loaded model backs the exploration view
 * (SPEC-002 REQ-006).
 */

import { stagesInRange } from '../domain/index.js';
import type {
  GeologicalStage,
  ReadModel,
  ReadOccurrence,
  ReadProfile,
  ReadTaxon,
  Source,
  SnapshotMetadata,
} from '../domain/index.js';

export interface OccurrenceFilter {
  /** ICS stage name, e.g. "Maastrichtian" — occurrences overlapping it. */
  stage?: string;
  /** Geologic period, e.g. "Cretaceous". */
  period?: string;
  taxonId?: string;
}

export class ReadApi {
  private constructor(private readonly model: ReadModel) {}

  /** Load from an in-memory read model (e.g. a published snapshot object). */
  static fromModel(model: ReadModel): ReadApi {
    return new ReadApi(model);
  }

  /** Load from the serialized static artifact (JSON string). No I/O beyond parse. */
  static fromJSON(json: string): ReadApi {
    return new ReadApi(JSON.parse(json) as ReadModel);
  }

  /**
   * A new API over the same shared reference (metadata/sources/taxa/profiles)
   * but a different occurrence set — the seam for SPEC-008 stage-partitioned
   * delivery, where occurrences are fetched per stage and joined to the reference
   * loaded once at boot. No I/O.
   */
  withOccurrences(occurrences: ReadOccurrence[]): ReadApi {
    return new ReadApi({ ...this.model, occurrences });
  }

  metadata(): SnapshotMetadata {
    return this.model.metadata;
  }

  listTaxa(): ReadTaxon[] {
    return this.model.taxa;
  }

  getTaxon(id: string): ReadTaxon | undefined {
    return this.model.taxa.find((t) => t.id === id);
  }

  getProfile(taxonId: string): ReadProfile | undefined {
    return this.model.profiles.find((p) => p.taxonId === taxonId);
  }

  resolveSource(sourceId: string): Source | undefined {
    return this.model.sources[sourceId];
  }

  listOccurrences(filter: OccurrenceFilter = {}): ReadOccurrence[] {
    return this.model.occurrences.filter((o) => {
      if (filter.taxonId && o.taxonId !== filter.taxonId) return false;
      const range = o.timeRange.value;
      if ((filter.stage || filter.period) && range) {
        const overlapping = stagesInRange(range.minMa, range.maxMa);
        if (filter.stage && !overlapping.some((s: GeologicalStage) => s.name === filter.stage)) {
          return false;
        }
        if (filter.period && !overlapping.some((s: GeologicalStage) => s.period === filter.period)) {
          return false;
        }
      }
      return true;
    });
  }
}
