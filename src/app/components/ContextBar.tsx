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
import styles from "./exploration.module.css";

interface ContextBarProps {
  stage: GeologicalStage | undefined;
  stageName: string;
  group: string;
  count: number;
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

        {/* SPEC-022 REQ-006: quiet text control at the trailing end of the row —
            the words stay, the button chrome goes. */}
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset view
        </button>
      </div>
    </div>
  );
}
