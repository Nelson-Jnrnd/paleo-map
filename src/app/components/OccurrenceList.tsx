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

/** Max occurrence rows rendered at once (the map holds the complete set). */
export const LIST_RENDER_CAP = 200;

export function OccurrenceList({
  api,
  occurrences,
  selectedId,
  onSelect,
}: OccurrenceListProps): ReactElement {
  // At real scale a stage can hold thousands of occurrences; render a bounded
  // window so the DOM stays fast (PERF-020/030). The map shows the complete,
  // clustered set; the list is the keyboard path into it, narrowed by age/
  // selection (SPEC-003 REQ-003, AMEND-001). Any selected occurrence is always
  // included so selecting a cluster point on the map surfaces its row.
  const total = occurrences.length;
  const shown = occurrences.slice(0, LIST_RENDER_CAP);
  if (selectedId && !shown.some((o) => o.id === selectedId)) {
    const sel = occurrences.find((o) => o.id === selectedId);
    if (sel) shown.unshift(sel);
  }
  const truncated = total > shown.length;

  return (
    <section aria-label="Visible occurrences">
      <div className={styles.listHeader}>
        <span className={styles.statLabel}>Occurrences</span>
        <p className={styles.source}>
          Documented discovery locations — not distribution ranges.
        </p>
        {truncated && (
          <p className={styles.source} role="status">
            Showing {shown.length} of {total} — narrow by age, or select a point/cluster on
            the map to reach the rest.
          </p>
        )}
      </div>
      <ul className={styles.list}>
        {shown.map((o) => {
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
