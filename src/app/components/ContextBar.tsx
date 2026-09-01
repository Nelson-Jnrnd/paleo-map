/**
 * Exploration context row (SPEC-003 REQ-001/005; SPEC-022 REQ-005). Permanently
 * displays the selected age (in Ma), the selected group and the visible-occurrence
 * count, plus the taxon search and the reset action — the persistent navigation
 * context the loop depends on (FONC-040/050/060/080, CONS-450).
 *
 * SPEC-022 reduced it: the wordmark and the Taxonomy / Dinordle buttons moved to
 * the global app bar, and nothing that moved may also remain here. It is no
 * longer a `<header>` of its own — the shell owns the single `role="banner"`
 * header and renders this row inside it, under the bar.
 *
 * SPEC-021 removed the scope subtext that used to sit under the title; SPEC-003
 * REQ-005's disclaimer criterion was retired with it (SPEC-003 AMEND-005).
 */

import type { ReactElement } from "react";
import type { GeologicalStage } from "../../domain/index.js";
import { formatStageSpan } from "../format.js";
import { TaxonSearch } from "./TaxonSearch.js";
import type { SearchableTaxon } from "../state/search.js";
import type { FrameMode } from "../state/frame.js";
import styles from "./exploration.module.css";

interface ContextBarProps {
  stage: GeologicalStage | undefined;
  stageName: string;
  group: string;
  count: number;
  /**
   * The map's frame, and its setter (SPEC-029 REQ-002/UX-001). The control sits
   * here rather than as a map overlay: it answers the same class of question as
   * its neighbours — what am I looking at — and it keeps SPEC-023's overlay
   * layout, and the non-overlap gate that polices it, untouched.
   *
   * `onFrameModeChange` absent → the present-day frame is not in the basemap
   * index, and no control is rendered at all (UX-002).
   */
  frameMode?: FrameMode;
  onFrameModeChange?: (mode: FrameMode) => void;
  /** In-memory taxon search index + selection handler (SPEC-013). */
  searchIndex: readonly SearchableTaxon[];
  onSearchSelect: (taxonId: string) => void;
  onReset: () => void;
}

export function ContextBar({
  stage,
  stageName,
  group,
  count,
  frameMode = "paleo",
  onFrameModeChange,
  searchIndex,
  onSearchSelect,
  onReset,
}: ContextBarProps): ReactElement {
  return (
    <div className={styles.header}>
      <TaxonSearch index={searchIndex} onSelect={onSearchSelect} />

      <div className={styles.context}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Selected age</span>
          <span className={styles.statValue}>
            {stageName}{" "}
            <span className="mono">
              {stage ? `· ${formatStageSpan(stage)}` : ""}
            </span>
          </span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>Group</span>
          <span className={styles.statValue}>{group}</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>Occurrences</span>
          <span
            className={`${styles.statValue} ${styles.countValue} mono`}
            aria-live="polite"
          >
            {count}
          </span>
        </div>

        {/* SPEC-029 REQ-002: the frame choice. Two options, single-choice, in
            the domain's own words — a reconstruction or today's map. Withheld
            entirely when the index carries no present-day frame (UX-002),
            because a control that cannot do anything is worse than none. */}
        {onFrameModeChange && (
          <div className={styles.stat}>
            <span className={styles.statLabel} id="frame-mode-label">
              Map
            </span>
            <div
              className={styles.frameGroup}
              role="radiogroup"
              aria-labelledby="frame-mode-label"
            >
              {(
                [
                  ["paleo", "Paleogeographic"],
                  ["present", "Present day"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={frameMode === value}
                  className={`${styles.frameOption} ${
                    frameMode === value ? styles.frameOptionOn : ""
                  }`}
                  onClick={() => onFrameModeChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SPEC-022 REQ-006: quiet text control at the trailing end of the row —
            the words stay, the button chrome goes. */}
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset view
        </button>
      </div>
    </div>
  );
}
