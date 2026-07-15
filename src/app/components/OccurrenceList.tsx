/**
 * Occurrence list (SPEC-003 REQ-003; SPEC-005). The keyboard-reachable path into
 * the occurrences, now **aggregated by taxon (default) or formation** and
 * **linked to the map viewport**: it shows the taxa/occurrences in the current
 * view, each group expandable to its occurrence rows. This bounds the DOM at any
 * scale (SPEC-005 REQ-004, superseding the SPEC-003 AMEND-001 flat cap) while
 * keeping source + reconstructed/approximate/missing cues per occurrence
 * (FONC-1100/1130/1140/1150, PERF-140/150/250) and the selection→panel→profile
 * loop (FONC-270/1070). Occurrences are discovery evidence, not ranges
 * (CONS-130/140).
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ReadOccurrence } from '../../domain/index.js';
import type { ReadApi } from '../../read/api.js';
import type { GroupBy } from '../state/aggregate.js';
import { groupOccurrences } from '../state/aggregate.js';
import { formatMaRange } from '../format.js';
import { sourceReference } from '../sources.js';
import { ApproximateCue, MissingValue, ReconstructedCue } from './Cues.js';
import styles from './exploration.module.css';

/** Max occurrence rows rendered per expanded group (the map holds them all). */
export const GROUP_OCC_CAP = 50;

interface OccurrenceListProps {
  api: ReadApi;
  /** Occurrences to show (already viewport-narrowed by the parent). */
  occurrences: readonly ReadOccurrence[];
  /** Total occurrences matching the active filters (for the "in view" framing). */
  totalInFilter: number;
  /** Whether the map viewport is currently driving the list. */
  viewportActive: boolean;
  groupBy: GroupBy;
  onGroupByChange: (by: GroupBy) => void;
  selectedId: string | null;
  onSelect: (occurrenceId: string) => void;
  onOpenProfile: (taxonId: string) => void;
}

function OccurrenceRow({
  api,
  occurrence,
  selected,
  onSelect,
}: {
  api: ReadApi;
  occurrence: ReadOccurrence;
  selected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const approximate = occurrence.timeRange.provenance.approximate;
  const paleoMissing = occurrence.paleoPosition.provenance.missing;
  return (
    <button
      type="button"
      className={styles.occurrenceRow}
      aria-current={selected}
      onClick={() => onSelect(occurrence.id)}
    >
      <span className={`${styles.occurrenceTaxon} sciName`}>{occurrence.taxonName}</span>
      <span className={styles.occurrenceMeta}>
        <span className="mono">{formatMaRange(occurrence.timeRange.value)}</span>
        <span>{occurrence.formation ?? occurrence.collectionName}</span>
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
        Source: {sourceReference(api, occurrence.modernPosition.sourceId)}
      </span>
    </button>
  );
}

export function OccurrenceList({
  api,
  occurrences,
  totalInFilter,
  viewportActive,
  groupBy,
  onGroupByChange,
  selectedId,
  onSelect,
  onOpenProfile,
}: OccurrenceListProps): ReactElement {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const groups = groupOccurrences(occurrences, groupBy);
  const selectedGroupKey = selectedId
    ? groups.find((g) => g.occurrences.some((o) => o.id === selectedId))?.key
    : undefined;

  const toggle = (key: string): void => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section aria-label="Visible occurrences">
      <div className={styles.listHeader}>
        <div className={styles.listHeaderTop}>
          <span className={styles.statLabel}>{viewportActive ? 'In view' : 'All occurrences'}</span>
          <div className={styles.groupByToggle} role="group" aria-label="Group occurrences by">
            <button
              type="button"
              aria-pressed={groupBy === 'taxon'}
              onClick={() => onGroupByChange('taxon')}
            >
              By taxon
            </button>
            <button
              type="button"
              aria-pressed={groupBy === 'formation'}
              onClick={() => onGroupByChange('formation')}
            >
              By formation
            </button>
          </div>
        </div>
        <p className={styles.source}>
          {groups.length} {groupBy === 'taxon' ? 'taxa' : 'formations'} · {occurrences.length}{' '}
          occurrences{viewportActive ? ' in view' : ''} — documented discovery locations, not
          ranges.
        </p>
      </div>

      {occurrences.length === 0 ? (
        <div className={styles.stateWrap} role="status">
          <p>No occurrences in the current map view.</p>
          <p className={styles.source}>
            Zoom out or pan the map — {totalInFilter} match the active filters.
          </p>
        </div>
      ) : (
        <ul className={styles.groupList}>
          {groups.map((group) => {
            const expanded = toggled.has(group.key) || group.key === selectedGroupKey;
            const shown = group.occurrences.slice(0, GROUP_OCC_CAP);
            if (
              selectedId &&
              group.key === selectedGroupKey &&
              !shown.some((o) => o.id === selectedId)
            ) {
              const sel = group.occurrences.find((o) => o.id === selectedId);
              if (sel) shown.unshift(sel);
            }
            const overflow = group.occurrences.length - shown.length;
            const panelId = `group-${group.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
            return (
              <li key={group.key} className={styles.group}>
                <div className={styles.groupHead}>
                  <button
                    type="button"
                    className={styles.groupToggle}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggle(group.key)}
                  >
                    <span className={styles.disclosure} aria-hidden="true">
                      {expanded ? '▾' : '▸'}
                    </span>
                    <span className={groupBy === 'taxon' ? 'sciName' : undefined}>
                      {group.label}
                    </span>
                    <span className={`${styles.groupCount} mono`}>{group.occurrences.length}</span>
                  </button>
                  {group.taxonId && (
                    <button
                      type="button"
                      className={styles.groupProfile}
                      onClick={() => onOpenProfile(group.taxonId!)}
                    >
                      Profile →
                    </button>
                  )}
                </div>
                {expanded && (
                  <ul className={styles.list} id={panelId}>
                    {shown.map((o) => (
                      <li key={o.id}>
                        <OccurrenceRow
                          api={api}
                          occurrence={o}
                          selected={o.id === selectedId}
                          onSelect={onSelect}
                        />
                      </li>
                    ))}
                    {overflow > 0 && (
                      <li className={styles.source} style={{ padding: 'var(--space-2) var(--space-4)' }}>
                        Showing {shown.length} of {group.occurrences.length} — zoom in for the rest.
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
