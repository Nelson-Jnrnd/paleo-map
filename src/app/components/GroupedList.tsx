/**
 * Grouped sidebar lists for Locality and Taxon modes (SPEC-010 REQ-003/004).
 * Same shape as the flat `OccurrenceList` (SPEC-009): a viewport-linked list with
 * an in-view count, a render cap with an overflow affordance, and keyboard-
 * operable rows. Locality rows collapse a collection (distinct-taxon count);
 * taxon rows collapse a taxon at the current rank tier (occurrence count). The
 * not-classified taxon bucket is shown plainly, never hidden (charter §2).
 */

import type { ReactElement } from "react";
import type { TimeRange } from "../../domain/index.js";
import { formatMaRange } from "../format.js";
import { LIST_RENDER_CAP } from "./OccurrenceList.js";
import type { LocalityGroup, TaxonGroup } from "../state/grouping.js";
import styles from "./exploration.module.css";

function span(minMa: number | null, maxMa: number | null): TimeRange | null {
  return minMa === null || maxMa === null ? null : { minMa, maxMa };
}

interface GroupedListHeaderProps {
  label: string;
  count: number;
  viewportActive: boolean;
  noun: string;
  overflow: number;
  shown: number;
}

function GroupedListHeader({
  label,
  count,
  viewportActive,
  noun,
  overflow,
  shown,
}: GroupedListHeaderProps): ReactElement {
  return (
    <div className={styles.listHeader}>
      <span className={styles.statLabel}>{viewportActive ? "In view" : label}</span>
      <p className={styles.listCount}>
        <span className={`${styles.countValue} mono`}>{count}</span>{" "}
        {viewportActive
          ? `${noun} in the current map view`
          : `${noun} at this age`}
      </p>
      {overflow > 0 && (
        <p className={styles.source}>
          Showing the first {shown} of {count} — zoom in to narrow the view.
        </p>
      )}
    </div>
  );
}

interface LocalityListProps {
  groups: readonly LocalityGroup[];
  totalAtAge: number;
  viewportActive: boolean;
  selectedId: string | null;
  onSelect: (collectionId: string) => void;
}

export function LocalityList({
  groups,
  totalAtAge,
  viewportActive,
  selectedId,
  onSelect,
}: LocalityListProps): ReactElement {
  if (groups.length === 0 && viewportActive && totalAtAge > 0) {
    return (
      <div className={styles.stateWrap} role="status">
        <p className={styles.stateTitle}>No localities in this view</p>
        <p>Zoom out or pan to bring localities back.</p>
      </div>
    );
  }
  const capped = groups.slice(0, LIST_RENDER_CAP);
  const overflow = groups.length - capped.length;

  return (
    <section className={styles.listPane} aria-label="Localities on the map">
      <GroupedListHeader
        label="Localities"
        count={groups.length}
        viewportActive={viewportActive}
        noun="locality(ies)"
        overflow={overflow}
        shown={capped.length}
      />
      <ul className={styles.list}>
        {capped.map((g) => (
          <li key={g.collectionId}>
            <button
              type="button"
              className={styles.occurrenceRow}
              aria-current={g.collectionId === selectedId ? "true" : undefined}
              onClick={() => onSelect(g.collectionId)}
            >
              <span className={styles.occurrenceTaxon}>
                {g.name}
                {g.formation ? ` · ${g.formation}` : ""}
              </span>
              <span className={styles.occurrenceMeta}>
                <span className="mono">{g.taxonCount}</span> taxa ·{" "}
                <span className="mono">{formatMaRange(span(g.minMa, g.maxMa))}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TaxonListProps {
  groups: readonly TaxonGroup[];
  viewportActive: boolean;
  selectedKey: string | null;
  onSelect: (taxonKey: string) => void;
}

export function TaxonList({
  groups,
  viewportActive,
  selectedKey,
  onSelect,
}: TaxonListProps): ReactElement {
  const capped = groups.slice(0, LIST_RENDER_CAP);
  const overflow = groups.length - capped.length;

  return (
    <section className={styles.listPane} aria-label="Taxa on the map">
      <GroupedListHeader
        label="Taxa"
        count={groups.length}
        viewportActive={viewportActive}
        noun="taxon(a)"
        overflow={overflow}
        shown={capped.length}
      />
      <ul className={styles.list}>
        {capped.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              className={styles.occurrenceRow}
              aria-current={g.key === selectedKey ? "true" : undefined}
              onClick={() => onSelect(g.key)}
            >
              <span
                className={
                  g.notClassified
                    ? styles.occurrenceTaxon
                    : `${styles.occurrenceTaxon} sciName`
                }
              >
                {g.name}
              </span>
              <span className={styles.occurrenceMeta}>
                <span className="mono">{g.count}</span> occurrence(s) ·{" "}
                <span className="mono">{formatMaRange(span(g.minMa, g.maxMa))}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
