/**
 * Viewport-linked occurrence list (SPEC-009 REQ-003/004; UX-001). A flat list of
 * the occurrences currently on the map — those inside the map viewport, or the full
 * age set when there is no viewport signal (no WebGL / map not yet loaded). It is the
 * keyboard/screen-reader path to an occurrence that SPEC-007 removed: activating a
 * row selects the occurrence and opens the panel (SPEC-003 REQ-006 loop).
 *
 * The list is two-way highlight-linked to the map (REQ-004): hovering/focusing a row
 * reports its id up (emphasising the map point), and the row for the shared
 * `highlightedId` — set from either surface — carries a highlight state and is
 * scrolled into view. Highlight is transient and weaker than selection (the clicked
 * row, `aria-current`). The rendered rows are bounded by a cap so the DOM cannot
 * blow up at real dataset scale; the selected row is always kept rendered.
 */

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { ReadOccurrence } from "../../domain/index.js";
import { formatMaRange } from "../format.js";
import { MultiStageCue } from "./Cues.js";
import styles from "./exploration.module.css";

/** Max rows rendered at once; the map stays the complete view (REQ-003). */
export const LIST_RENDER_CAP = 300;

interface OccurrenceListProps {
  /** The occurrences to list (already narrowed to the viewport by the caller). */
  occurrences: readonly ReadOccurrence[];
  /** Count of all occurrences at the selected age, for the empty-in-view state. */
  totalAtAge: number;
  /** Whether a map viewport signal is driving the narrowing (else full-set fallback). */
  viewportActive: boolean;
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (occurrenceId: string) => void;
  onHover: (occurrenceId: string | null) => void;
}

export function OccurrenceList({
  occurrences,
  totalAtAge,
  viewportActive,
  selectedId,
  highlightedId,
  onSelect,
  onHover,
}: OccurrenceListProps): ReactElement {
  const highlightedRowRef = useRef<HTMLButtonElement | null>(null);

  // Bring the highlighted row into view when the highlight is driven from the map
  // (harmless when it is already visible). Guarded for jsdom, which has no layout.
  useEffect(() => {
    const el = highlightedRowRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedId]);

  // Recoverable empty-in-view state: the age has occurrences, but none are in the
  // current view. Distinct from the "no occurrences at this age" empty state.
  if (occurrences.length === 0 && viewportActive && totalAtAge > 0) {
    return (
      <div className={styles.stateWrap} role="status">
        <p className={styles.stateTitle}>No occurrences in this view</p>
        <p>
          None of the {totalAtAge} occurrences at this age fall inside the
          current map view. Zoom out or pan to bring points back.
        </p>
      </div>
    );
  }

  // Keep the selected row rendered even if it sits past the cap.
  const capped = occurrences.slice(0, LIST_RENDER_CAP);
  const overflow = occurrences.length - capped.length;
  if (
    selectedId &&
    !capped.some((o) => o.id === selectedId) &&
    occurrences.some((o) => o.id === selectedId)
  ) {
    const selected = occurrences.find((o) => o.id === selectedId);
    if (selected) capped[capped.length - 1] = selected;
  }

  return (
    <section className={styles.listPane} aria-label="Occurrences on the map">
      <div className={styles.listHeader}>
        <span className={styles.statLabel}>
          {viewportActive ? "In view" : "Occurrences"}
        </span>
        <p className={styles.listCount}>
          <span className={`${styles.countValue} mono`}>
            {occurrences.length}
          </span>{" "}
          {viewportActive
            ? "occurrence(s) in the current map view"
            : "occurrence(s) at this age"}
        </p>
        {overflow > 0 && (
          <p className={styles.source}>
            Showing the first {capped.length} of {occurrences.length} — zoom in
            to narrow the view.
          </p>
        )}
      </div>

      <ul className={styles.list}>
        {capped.map((occurrence) => {
          const isSelected = occurrence.id === selectedId;
          const isHighlighted = occurrence.id === highlightedId;
          return (
            <li key={occurrence.id}>
              <button
                type="button"
                ref={isHighlighted ? highlightedRowRef : undefined}
                className={styles.occurrenceRow}
                aria-current={isSelected ? "true" : undefined}
                data-highlighted={isHighlighted ? "true" : undefined}
                onClick={() => onSelect(occurrence.id)}
                onMouseEnter={() => onHover(occurrence.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(occurrence.id)}
                onBlur={() => onHover(null)}
              >
                <span className={`${styles.occurrenceTaxon} sciName`}>
                  {occurrence.taxonName}
                </span>
                <span className={styles.occurrenceMeta}>
                  <span className="mono">
                    {formatMaRange(occurrence.timeRange.value)}
                  </span>
                  {occurrence.timeRange.provenance.approximate && (
                    <MultiStageCue />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
