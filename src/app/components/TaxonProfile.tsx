/**
 * Taxon profile (SPEC-003 REQ-007). Reached in ≤2 actions from a visible
 * occurrence (occurrence row → Open taxon profile), and offers a single "Back to
 * map" action that preserves the selected age and filters (FONC-990/1000/1010/
 * 1020/1070/1080, CONS-460/470). Shows name, rank, validity (flagging non-valid
 * status with its citation — FONC-720), time range, the taxon's occurrences with
 * modern + reconstructed positions and sources, and — visually separated —
 * interpretative biology (FONC-670, CONS-440). Minimal profiles are labeled
 * (FONC-1300) and missing fields read "Not available" (PERF-180).
 */

import type { ReactElement } from "react";
import type { ReadOccurrence, TimeRange } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { formatMaRange, NOT_AVAILABLE } from "../format.js";
import { sourceReference } from "../sources.js";
import {
  ApproximateCue,
  AttentionNote,
  InterpretativeCue,
  MissingValue,
  ReconstructedCue,
} from "./Cues.js";
import styles from "./exploration.module.css";

interface TaxonProfileProps {
  api: ReadApi;
  taxonId: string;
  onBack: () => void;
}

function taxonTimeRange(occurrences: readonly ReadOccurrence[]): {
  range: TimeRange | null;
  approximate: boolean;
} {
  let minMa = Infinity;
  let maxMa = -Infinity;
  let approximate = false;
  for (const o of occurrences) {
    const r = o.timeRange.value;
    if (!r) continue;
    minMa = Math.min(minMa, r.minMa);
    maxMa = Math.max(maxMa, r.maxMa);
    if (o.timeRange.provenance.approximate) approximate = true;
  }
  if (!Number.isFinite(minMa)) return { range: null, approximate };
  return { range: { minMa, maxMa }, approximate };
}

export function TaxonProfile({
  api,
  taxonId,
  onBack,
}: TaxonProfileProps): ReactElement {
  const taxon = api.getTaxon(taxonId);
  const profile = api.getProfile(taxonId);
  const occurrences = api.listOccurrences({ taxonId });
  const { range, approximate } = taxonTimeRange(occurrences);

  if (!taxon) {
    // Real data holds occurrences identified only to an indeterminate or higher
    // rank (e.g. "Theropoda indet.") with no genus-level taxon record. Show an
    // honest, navigable profile rather than a dead end (charter §2/§7).
    const fallbackName = occurrences[0]?.taxonName ?? "Unavailable";
    return (
      <section
        className={styles.profile}
        aria-label={`Taxon profile: ${fallbackName}`}
      >
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to map
        </button>
        <header className={styles.profileHeader}>
          <h1 className="sciName">{fallbackName}</h1>
          <div className={styles.profileMeta}>
            <AttentionNote>
              Indeterminate identification — no genus-level taxon record
            </AttentionNote>
          </div>
        </header>
        <div className={styles.section}>
          <span className={styles.statLabel}>Occurrences</span>
          <p className={styles.fieldValue}>
            <span className="mono">{occurrences.length}</span> occurrence(s)
            recorded under this identification.
          </p>
        </div>
      </section>
    );
  }

  const validity = taxon.validity.value;
  const isMinimal = profile?.contentLevel === "OccurrenceOnly";

  return (
    <section
      className={styles.profile}
      aria-label={`Taxon profile: ${taxon.scientificName}`}
    >
      <button type="button" className={styles.back} onClick={onBack}>
        ← Back to map
      </button>

      <header className={styles.profileHeader}>
        <h1 className="sciName">{taxon.scientificName}</h1>
        <div className={styles.profileMeta}>
          <span>{taxon.rank}</span>
          {validity && validity !== "Valid" ? (
            <AttentionNote>
              {validity}
              {taxon.acceptedPer ? ` — accepted per ${taxon.acceptedPer}` : ""}
            </AttentionNote>
          ) : (
            <span className={styles.source}>
              Valid{taxon.acceptedPer ? ` · per ${taxon.acceptedPer}` : ""}
            </span>
          )}
          <span className={styles.source}>Main content</span>
        </div>
        {isMinimal && (
          <AttentionNote>Occurrence only — minimal profile</AttentionNote>
        )}
      </header>

      <div className={styles.section}>
        <span className={styles.statLabel}>Time range</span>
        <p className={styles.fieldValue}>
          <span className="mono">{formatMaRange(range)}</span>{" "}
          {approximate && <ApproximateCue />}
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.statLabel}>
          Occurrences ({occurrences.length})
        </span>
        <ul className={styles.list}>
          {occurrences.map((o) => {
            const paleo = o.paleoPosition.value;
            return (
              <li key={o.id} className={styles.occCard}>
                <span className={styles.occurrenceMeta}>
                  <span className="mono">
                    {formatMaRange(o.timeRange.value)}
                  </span>
                  <span>{o.formation ?? o.collectionName}</span>
                </span>
                <span className={styles.occurrenceMeta}>
                  <span>
                    Modern: {o.modernPosition.value?.region ?? NOT_AVAILABLE}
                  </span>
                  {paleo ? (
                    <span>
                      Paleo:{" "}
                      <span className="mono">
                        {paleo.palaeoLat.toFixed(1)}°,{" "}
                        {paleo.palaeoLng.toFixed(1)}°
                      </span>{" "}
                      <ReconstructedCue />
                    </span>
                  ) : (
                    <span>
                      Paleo: <MissingValue />
                    </span>
                  )}
                </span>
                <span className={styles.source}>
                  Source: {sourceReference(api, o.modernPosition.sourceId)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={`${styles.section} ${styles.interpretativeBlock}`}>
        <div className={styles.interpretativeHead}>
          <span className={styles.statLabel}>Interpretative</span>
          <InterpretativeCue />
        </div>
        <p className={styles.source}>
          Inferred biology — separated from fossil-derived data.
        </p>

        {profile?.summary?.value ? (
          <p className={styles.fieldValue}>{profile.summary.value}</p>
        ) : (
          <p className={styles.fieldValue}>
            Summary: <MissingValue />
          </p>
        )}

        <dl className={styles.fieldGrid}>
          {(profile?.attributes ?? []).map((attr) => (
            <div key={attr.kind} style={{ display: "contents" }}>
              <dt className={styles.fieldLabel}>{attr.kind}</dt>
              <dd className={styles.fieldValue}>
                {attr.value.value ?? NOT_AVAILABLE}
              </dd>
            </div>
          ))}
          {(profile?.measurements ?? []).map((m) => (
            <div key={m.kind} style={{ display: "contents" }}>
              <dt className={styles.fieldLabel}>{m.kind}</dt>
              <dd className={styles.fieldValue}>
                {m.value.value !== null ? (
                  <span className="mono">
                    {m.value.value} {m.unit}
                    {m.lowerBound !== null && m.upperBound !== null
                      ? ` (${m.lowerBound}–${m.upperBound} ${m.unit})`
                      : ""}
                  </span>
                ) : (
                  <MissingValue />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
