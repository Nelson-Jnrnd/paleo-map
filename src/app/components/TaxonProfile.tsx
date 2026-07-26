/**
 * Taxon profile (SPEC-003 REQ-007). Reached in ≤2 actions from a visible
 * occurrence (occurrence row → Open taxon profile), and offers a single "Back to
 * map" action that preserves the selected age and filters (FONC-990/1000/1010/
 * 1020/1070/1080, CONS-460/470). Shows name, rank, validity (flagging non-valid
 * status with its citation — FONC-720), time range, a summary + biology block,
 * and the taxon's occurrences with modern and paleogeographic positions and
 * sources. Minimal profiles are labeled (FONC-1300) and missing fields read "Not
 * available" (PERF-180). SPEC-007 moved the summary/biology above the occurrence
 * list and retired the reconstructed and interpretative cues.
 */

import type { ReactElement } from "react";
import type { ReadOccurrence, TimeRange } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { formatMaRange, NOT_AVAILABLE } from "../format.js";
import { sourceReference } from "../sources.js";
import { AttentionNote, MissingValue } from "./Cues.js";
import { Illustration } from "./Illustration.js";
import { TaxonEnrichment } from "./TaxonEnrichment.js";
import { silhouetteForTaxon } from "./cladeSilhouette.js";
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
  // Taxon lineage index, for resolving the taxon's major-group silhouette
  // (SPEC-012 REQ-004).
  const taxaById = new Map(api.listTaxa().map((t) => [t.id, t]));
  // Prefer the whole-snapshot aggregates (SPEC-008 AMEND-001) so the time span
  // and count reflect the taxon's full record even when only one stage is
  // loaded; fall back to the loaded occurrences when no profile is present.
  const windowed = taxonTimeRange(occurrences);
  const range = profile?.timeSpan ?? windowed.range;
  const totalCount = profile?.occurrenceCount ?? occurrences.length;

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
        <Illustration
          taxonName={fallbackName}
          images={[]}
          silhouette={silhouetteForTaxon(
            occurrences[0]?.taxonId ?? "",
            taxaById,
          )}
          bodyLengthM={null}
        />
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

  // Illustration inputs (SPEC-014 REQ-003/004): the showable image gallery
  // (licence + credit already guaranteed by DATA-007), the group silhouette
  // fallback, and the body length for the size scale (metres; omitted when
  // unknown).
  const galleryImages = profile?.images ?? [];
  const silhouette = silhouetteForTaxon(taxonId, taxaById);
  const bodyLength = profile?.measurements.find((m) => m.kind === "BodyLength");
  const bodyLengthM =
    bodyLength && bodyLength.value.value !== null
      ? bodyLength.value.value
      : null;

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
        </div>
        {isMinimal && (
          <AttentionNote>Occurrence only — minimal profile</AttentionNote>
        )}
      </header>

      <Illustration
        taxonName={taxon.scientificName}
        images={galleryImages}
        silhouette={silhouette}
        bodyLengthM={bodyLengthM}
      />

      <div className={styles.section}>
        {/* The taxon's full recorded span across all occurrences (SPEC-008
            AMEND-001), labelled so it is not mistaken for a contradiction with
            the per-age occurrence rows below (SPEC-011 REQ-005). */}
        <span className={styles.statLabel}>
          Recorded span · all occurrences
        </span>
        <p className={styles.fieldValue}>
          <span className="mono">{formatMaRange(range)}</span>
        </p>
      </div>

      {profile?.enrichment ? (
        // SPEC-014 REQ-005: the AI-assisted enrichment supersedes the raw
        // Wikipedia summary + PBDB biology grid when a cached record exists.
        <TaxonEnrichment enrichment={profile.enrichment} />
      ) : (
        <div className={styles.section}>
          <span className={styles.statLabel}>Summary &amp; biology</span>

          {profile?.summary?.value ? (
            <p className={styles.fieldValue}>{profile.summary.value}</p>
          ) : (
            <p className={styles.fieldValue}>
              Summary: <MissingValue />
            </p>
          )}

          <dl className={styles.fieldGrid}>
            {/* PBDB Locomotion/Habitat are dropped from the page (SPEC-014 data
                model impact); only Diet remains of the ecospace attributes. */}
            {(profile?.attributes ?? [])
              .filter((attr) => attr.kind === "Diet")
              .map((attr) => (
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
      )}

      <div className={styles.section}>
        <span className={styles.statLabel}>Occurrences ({totalCount})</span>
        {occurrences.length < totalCount && (
          <p className={styles.source}>
            Showing {occurrences.length} at the selected age; step the timeline
            to see this taxon at other ages.
          </p>
        )}
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
                      </span>
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
    </section>
  );
}
