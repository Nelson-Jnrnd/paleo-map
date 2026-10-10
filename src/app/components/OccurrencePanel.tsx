/**
 * Occurrence panel (SPEC-003 REQ-006). Shown when an occurrence is selected; its
 * one primary action is "Open taxon profile" (charter §5). Displays at minimum
 * the taxon, time range, modern location, paleogeographic position and source,
 * with missing values shown as an explicit "Not available" label and a
 * multi-stage time range labelled (FONC-289/290/890/900/910/920/930/1150,
 * PERF-180). SPEC-007 retired the reconstructed cue.
 */

import type { ReactElement } from "react";
import type { ReadOccurrence } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { formatMaRange } from "../format.js";
import { OccurrenceEvidence } from "./RecordDetails.js";
import styles from "./exploration.module.css";

interface OccurrencePanelProps {
  api: ReadApi;
  occurrence: ReadOccurrence;
  onOpenProfile: (taxonId: string) => void;
  onClose: () => void;
  /** Names the list this detail replaced (SPEC-026 REQ-003). */
  backLabel: string;
}

export function OccurrencePanel({
  api,
  occurrence,
  onOpenProfile,
  onClose,
  backLabel,
}: OccurrencePanelProps): ReactElement {
  const modern = occurrence.modernPosition.value;
  // SPEC-014 AMEND-005: only taxa with a resolved Wikipedia article have a page.
  const hasArticle = Boolean(api.getTaxon(occurrence.taxonId)?.wikipedia);

  return (
    <section
      className={styles.panel}
      aria-label={`Occurrence: ${occurrence.taxonName}`}
    >
      {/* SPEC-026 REQ-003: the close control becomes a back control that names
          the list it returns to, because the detail now *replaces* that list. */}
      <button type="button" className={styles.panelBack} onClick={onClose}>
        ← {backLabel}
      </button>
      <div className={styles.panelHead}>
        <h2 className="sciName">{occurrence.taxonName}</h2>
      </div>

      <dl className={styles.fieldGrid}>
        <dt className={styles.fieldLabel}>Time range</dt>
        <dd className={styles.fieldValue}>
          <span className="mono">
            {formatMaRange(occurrence.timeRange.value)}
          </span>
        </dd>

        {modern && (
          <>
            <dt className={styles.fieldLabel}>Found in</dt>
            <dd className={styles.fieldValue}>{modern.region}</dd>
          </>
        )}
      </dl>

      <details className={styles.evidence}>
        <summary>Details and sources</summary>
        <OccurrenceEvidence api={api} occurrence={occurrence} />
      </details>
      {hasArticle ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => onOpenProfile(occurrence.taxonId)}
        >
          Read about this dinosaur
        </button>
      ) : null}
    </section>
  );
}
