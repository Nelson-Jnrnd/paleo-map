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
import { sourceReference } from "../sources.js";
import { MissingValue } from "./Cues.js";
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
  const paleo = occurrence.paleoPosition.value;
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

        <dt className={styles.fieldLabel}>Modern location</dt>
        <dd className={styles.fieldValue}>
          {modern ? (
            <>
              {modern.region}{" "}
              <span className="mono">
                ({modern.lat.toFixed(1)}°, {modern.lng.toFixed(1)}°)
              </span>
            </>
          ) : (
            <MissingValue />
          )}
        </dd>

        <dt className={styles.fieldLabel}>Paleogeographic position</dt>
        <dd className={styles.fieldValue}>
          {paleo ? (
            <span className="mono">
              {paleo.palaeoLat.toFixed(1)}°, {paleo.palaeoLng.toFixed(1)}°
            </span>
          ) : (
            <MissingValue />
          )}
        </dd>

        <dt className={styles.fieldLabel}>Source</dt>
        <dd className={styles.fieldValue}>
          {sourceReference(api, occurrence.modernPosition.sourceId)}
        </dd>
      </dl>

      {hasArticle ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => onOpenProfile(occurrence.taxonId)}
        >
          Open taxon profile →
        </button>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled
          title="No Wikipedia article for this taxon"
        >
          Open taxon profile →
        </button>
      )}
    </section>
  );
}
