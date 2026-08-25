/**
 * The sidebar's one list (SPEC-026 REQ-002). Every unit — Occurrence, Locality,
 * Genus, Family, Major group — renders through this component.
 *
 * Before SPEC-026 there were three near-duplicate list/panel pairs that had
 * drifted apart: two different header implementations, a hover linkage wired for
 * one unit only, and an empty-in-view state that existed in one of them. Here the
 * **chrome is shared and the row body varies** — the region and its name, the
 * count line, the viewport-versus-age wording, the render cap and its overflow
 * line, the empty-in-view state, the keep-the-selected-row rule and the two-way
 * highlight are one implementation for all five units (REQ-002, REQ-006).
 *
 * A row is a name line plus a meta line of **at most two values** (owner review,
 * 2026-08-14). The caller decides what those two are; this component decides
 * nothing about content.
 */

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import styles from "./exploration.module.css";

/** Rendering limit for a single list pass (SPEC-009). */
export const LIST_RENDER_CAP = 300;

export interface UnitRow {
  /** Stable key and selection id for this row. */
  key: string;
  name: string;
  /** Scientific names are italicised (CONS-350); place names are not. */
  scientific: boolean;
  /** At most two values — REQ-002 caps the meta line. */
  meta: readonly string[];
  /**
   * UX-002: the clade tint, or null for a locality — a locality is a place, not
   * a clade. The clade is never named on the row; it is in the row's accessible
   * name and in the detail the row opens, so the tint never carries a meaning
   * that has no worded form.
   */
  cladeTint: string | null;
  /** The full worded name, including the clade when the row carries a tint. */
  accessibleName: string;
}

interface UnitListProps {
  /** Accessible name for the region, e.g. "Genera on the map". */
  label: string;
  /** The unit's noun for the count line, e.g. "genera". */
  noun: string;
  rows: readonly UnitRow[];
  /** Total at the selected age, for the empty-in-view state. */
  totalAtAge: number;
  viewportActive: boolean;
  selectedKey: string | null;
  highlightedKey: string | null;
  onSelect: (key: string) => void;
  onHighlight: (key: string | null) => void;
}

export function UnitList({
  label,
  noun,
  rows,
  totalAtAge,
  viewportActive,
  selectedKey,
  highlightedKey,
  onSelect,
  onHighlight,
}: UnitListProps): ReactElement {
  const highlightedRowRef = useRef<HTMLButtonElement | null>(null);

  // Bring a row into view when the highlight is driven from the map (harmless
  // when already visible). Guarded for jsdom, which has no layout.
  useEffect(() => {
    const el = highlightedRowRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedKey]);

  // Recoverable empty-in-view state: the age has records, but none are in the
  // current view. Distinct from "no occurrences at this age".
  if (rows.length === 0 && viewportActive && totalAtAge > 0) {
    return (
      <div className={styles.stateWrap} role="status">
        <p className={styles.stateTitle}>Nothing in this view</p>
        <p>
          None of the {totalAtAge} occurrences at this age fall inside the
          current map view. Zoom out or pan to bring points back.
        </p>
      </div>
    );
  }

  // Keep the selected row rendered even if it sits past the cap.
  const capped = rows.slice(0, LIST_RENDER_CAP);
  const overflow = rows.length - capped.length;
  if (selectedKey && !capped.some((r) => r.key === selectedKey)) {
    const selected = rows.find((r) => r.key === selectedKey);
    if (selected) capped[capped.length - 1] = selected;
  }

  return (
    <section className={styles.listPane} aria-label={label}>
      <div className={styles.listHeader}>
        <span className={styles.statLabel}>
          {viewportActive ? "In view" : label}
        </span>
        <p className={styles.listCount}>
          <span className={`${styles.countValue} mono`}>{rows.length}</span>{" "}
          {viewportActive ? `${noun} in the current map view` : `${noun} at this age`}
        </p>
        {overflow > 0 && (
          <p className={styles.source}>
            Showing the first {capped.length} of {rows.length} — zoom in to
            narrow the view.
          </p>
        )}
      </div>

      <ul className={styles.list}>
        {capped.map((row) => {
          const isSelected = row.key === selectedKey;
          const isHighlighted = row.key === highlightedKey;
          return (
            <li key={row.key}>
              <button
                type="button"
                ref={isHighlighted ? highlightedRowRef : undefined}
                className={styles.unitRow}
                aria-label={row.accessibleName}
                aria-current={isSelected ? "true" : undefined}
                data-highlighted={isHighlighted ? "true" : undefined}
                style={
                  row.cladeTint
                    ? ({ "--clade-tint": row.cladeTint } as Record<
                        string,
                        string
                      >)
                    : undefined
                }
                data-clade={row.cladeTint ? "true" : undefined}
                onClick={() => onSelect(row.key)}
                onMouseEnter={() => onHighlight(row.key)}
                onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(row.key)}
                onBlur={() => onHighlight(null)}
              >
                <span
                  className={`${styles.unitRowName} ${row.scientific ? "sciName" : ""}`}
                >
                  {row.name}
                </span>
                {row.meta.length > 0 && (
                  <span className={styles.unitRowMeta}>
                    {row.meta.join(" · ")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
