/**
 * Occurrence list (SPEC-003 REQ-003) — the keyboard-reachable, provenance-legible
 * path to every visible occurrence, equivalent to the map markers and independent
 * of the map canvas (charter; SPEC-002 canvas-a11y edge case). Each row shows the
 * taxon (italic scientific name), the time range in Ma, and an identifiable
 * source, and marks reconstructed position / approximate range / missing
 * paleoposition with text labels, not colour alone (FONC-1100/1130/1140/1150,
 * PERF-140/150/250). Occurrences are framed as discovery evidence, not ranges
 * (CONS-130/140).
 */

import type { ReactElement } from 'react';
import type { ReadOccurrence } from '../../domain/index.js';
import type { ReadApi } from '../../read/api.js';
import { formatMaRange } from '../format.js';
import { sourceReference } from '../sources.js';
import { ApproximateCue, MissingValue, ReconstructedCue } from './Cues.js';
import styles from './exploration.module.css';

interface OccurrenceListProps {
  api: ReadApi;
  occurrences: readonly ReadOccurrence[];
  selectedId: string | null;
  onSelect: (occurrenceId: string) => void;
}

export function OccurrenceList({
  api,
  occurrences,
  selectedId,
  onSelect,
}: OccurrenceListProps): ReactElement {
  return (
    <section aria-label="Visible occurrences">
      <div className={styles.listHeader}>
        <span className={styles.statLabel}>Occurrences</span>
        <p className={styles.source}>
          Documented discovery locations — not distribution ranges.
        </p>
      </div>
      <ul className={styles.list}>
        {occurrences.map((o) => {
          const isSelected = o.id === selectedId;
          const approximate = o.timeRange.provenance.approximate;
          const paleoMissing = o.paleoPosition.provenance.missing;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={styles.occurrenceRow}
                aria-current={isSelected}
                onClick={() => onSelect(o.id)}
              >
                <span className={`${styles.occurrenceTaxon} sciName`}>{o.taxonName}</span>
                <span className={styles.occurrenceMeta}>
                  <span className="mono">{formatMaRange(o.timeRange.value)}</span>
                  <span>{o.formation ?? o.collectionName}</span>
                </span>
                <span className={styles.cues}>
                  {approximate && <ApproximateCue />}
                  {paleoMissing ? (
                    <span className={styles.source}>
                      Paleoposition: <MissingValue />
                    </span>
                  ) : (
                    <ReconstructedCue />
                  )}
                </span>
                <span className={styles.source}>
                  Source: {sourceReference(api, o.modernPosition.sourceId)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
