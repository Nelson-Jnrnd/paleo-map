/**
 * Context bar (SPEC-003 REQ-001/005). Permanently displays the selected age (in
 * Ma), the selected group, and the visible-occurrence count, plus the reset
 * action — the persistent navigation context the loop depends on (FONC-040/050/
 * 060/080, CONS-450). It also states the app is not a complete atlas of all
 * Mesozoic life (FONC-400).
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
  /** Open the dedicated taxonomy screen (SPEC-017). */
  onOpenTaxonomy?: () => void;
}

export function ContextBar({
  stage,
  stageName,
  group,
  count,
  searchIndex,
  onSearchSelect,
  onReset,
  onOpenTaxonomy,
}: ContextBarProps): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1 className={styles.brandTitle}>Mesozoic Dinosaur Atlas</h1>
        <span className={styles.brandSub}>
          Non-avian dinosaurs · fossil occurrences · not a complete atlas of
          Mesozoic life
        </span>
      </div>

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

        {onOpenTaxonomy && (
          <button
            type="button"
            className={styles.reset}
            onClick={onOpenTaxonomy}
          >
            Taxonomy
          </button>
        )}

        <button type="button" className={styles.reset} onClick={onReset}>
          Reset view
        </button>
      </div>
    </header>
  );
}
