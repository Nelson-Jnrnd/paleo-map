/** SPEC-031: record evidence is reachable without occupying the primary view. */
import { useState } from "react";
import type { ReactElement } from "react";
import type { ReadOccurrence } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { formatMaRange } from "../format.js";
import { sourceReference } from "../sources.js";
import styles from "./exploration.module.css";

export function OccurrenceEvidence({
  api,
  occurrence,
}: {
  api: ReadApi;
  occurrence: ReadOccurrence;
}): ReactElement {
  const modern = occurrence.modernPosition.value;
  const paleo = occurrence.paleoPosition.value;
  const sources = [
    ...new Set([
      occurrence.timeRange.sourceId,
      occurrence.modernPosition.sourceId,
      occurrence.paleoPosition.sourceId,
    ]),
  ].filter((id): id is string => Boolean(id));
  return (
    <dl className={styles.fieldGrid}>
      <dt className={styles.fieldLabel}>Record</dt>
      <dd className={styles.fieldValue}>{occurrence.id}</dd>
      {occurrence.formation && (
        <>
          <dt className={styles.fieldLabel}>Formation</dt>
          <dd className={styles.fieldValue}>{occurrence.formation}</dd>
        </>
      )}
      {modern && (
        <>
          <dt className={styles.fieldLabel}>Modern coordinates</dt>
          <dd className={styles.fieldValue}>
            {modern.lat.toFixed(1)}°, {modern.lng.toFixed(1)}°
          </dd>
        </>
      )}
      {paleo && (
        <>
          <dt className={styles.fieldLabel}>Paleogeographic position</dt>
          <dd className={styles.fieldValue}>
            {paleo.palaeoLat.toFixed(1)}°, {paleo.palaeoLng.toFixed(1)}°
          </dd>
          <dt className={styles.fieldLabel}>Rotation model</dt>
          <dd className={styles.fieldValue}>
            {paleo.rotationModel}
            {paleo.reconstructionAgeMa != null
              ? ` · ${paleo.reconstructionAgeMa} Ma`
              : ""}
          </dd>
        </>
      )}
      {sources.map((id) => (
        <div className={styles.evidenceSource} key={id}>
          <dt className={styles.fieldLabel}>Source</dt>
          <dd className={styles.fieldValue}>{sourceReference(api, id)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordDetails({
  api,
  occurrences,
}: {
  api: ReadApi;
  occurrences: readonly ReadOccurrence[];
}): ReactElement | null {
  const [limit, setLimit] = useState(25);
  if (!occurrences.length) return null;
  return (
    <details className={styles.evidence}>
      <summary>Details and sources</summary>
      <p className={styles.source}>
        {occurrences.length} fossil{" "}
        {occurrences.length === 1 ? "record" : "records"}
      </p>
      {occurrences.slice(0, limit).map((o) => (
        <details key={o.id} className={styles.recordEvidence}>
          <summary>
            {o.taxonName} · {o.collectionName}
          </summary>
          {o.timeRange.value && <p>{formatMaRange(o.timeRange.value)}</p>}
          <OccurrenceEvidence api={api} occurrence={o} />
        </details>
      ))}
      {occurrences.length > limit && (
        <button
          type="button"
          className={styles.reset}
          onClick={() => setLimit((n) => n + 25)}
        >
          Load more records
        </button>
      )}
    </details>
  );
}
