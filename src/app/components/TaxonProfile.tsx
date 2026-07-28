/**
 * Taxon profile (SPEC-003 REQ-007; SPEC-014 REQ-005 / AMEND-002 layout). Reached
 * in ≤2 actions from a visible occurrence, with a single "Back to map" that
 * preserves the selected age and filters. Laid out as the "spec sheet": a top bar
 * (back + taxonomy breadcrumb navigation), an identity header (name · one-liner ·
 * period · rank · validity), a two-column hero (large image gallery + a ruled
 * at-a-glance spec table with the size-vs-human silhouette), the About block, the
 * collapsed fossil-occurrence list, and a single sources footer.
 */

import type { ReactElement } from "react";
import type { ReadOccurrence, TimeRange } from "../../domain/index.js";
import { MESOZOIC_STAGES } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { formatMaRange, NOT_AVAILABLE } from "../format.js";
import { sourceReference } from "../sources.js";
import { AttentionNote, MissingValue } from "./Cues.js";
import { Illustration } from "./Illustration.js";
import { TaxonEnrichment } from "./TaxonEnrichment.js";
import { TaxonSpecTable } from "./TaxonSpecTable.js";
import { TaxonomyTree } from "./TaxonomyTree.js";
import { silhouetteForTaxon } from "./cladeSilhouette.js";
import styles from "./exploration.module.css";

interface TaxonProfileProps {
  api: ReadApi;
  taxonId: string;
  onBack: () => void;
  /** Open another taxon's profile (SPEC-014 REQ-006: navigable ancestor links). */
  onOpenTaxon: (taxonId: string) => void;
}

const PERIOD_TOKEN: Readonly<Record<string, string>> = {
  Triassic: "var(--color-period-triassic)",
  Jurassic: "var(--color-period-jurassic)",
  Cretaceous: "var(--color-period-cretaceous)",
};

/** ICS period + colour token for the midpoint of a recorded span (AMEND-002). */
function periodForRange(
  range: TimeRange | null,
): { name: string; colour: string } | null {
  if (!range) return null;
  const mid = (range.minMa + range.maxMa) / 2;
  const stage = MESOZOIC_STAGES.find((s) => mid <= s.startMa && mid >= s.endMa);
  if (!stage) return null;
  return {
    name: stage.period,
    colour: PERIOD_TOKEN[stage.period] ?? "var(--color-text-muted)",
  };
}

function taxonTimeRange(
  occurrences: readonly ReadOccurrence[],
): TimeRange | null {
  let minMa = Infinity;
  let maxMa = -Infinity;
  for (const o of occurrences) {
    const r = o.timeRange.value;
    if (!r) continue;
    minMa = Math.min(minMa, r.minMa);
    maxMa = Math.max(maxMa, r.maxMa);
  }
  return Number.isFinite(minMa) ? { minMa, maxMa } : null;
}

export function TaxonProfile({
  api,
  taxonId,
  onBack,
  onOpenTaxon,
}: TaxonProfileProps): ReactElement {
  const taxon = api.getTaxon(taxonId);
  const profile = api.getProfile(taxonId);
  const occurrences = api.listOccurrences({ taxonId });
  const taxaById = new Map(api.listTaxa().map((t) => [t.id, t]));
  // Whole-snapshot aggregates (SPEC-008 AMEND-001) so span + count reflect the
  // taxon's full record even when only one stage is loaded.
  const range = profile?.timeSpan ?? taxonTimeRange(occurrences);
  const totalCount = profile?.occurrenceCount ?? occurrences.length;
  const formationCount = new Set(
    occurrences.map((o) => o.formation).filter((f): f is string => Boolean(f)),
  ).size;

  if (!taxon) {
    const fallbackName = occurrences[0]?.taxonName ?? "Unavailable";
    return (
      <section
        className={styles.profile}
        aria-label={`Taxon profile: ${fallbackName}`}
      >
        <div className={styles.topbar}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← Back to map
          </button>
        </div>
        <header className={styles.idHeader}>
          <h1 className={`sciName ${styles.idName}`}>{fallbackName}</h1>
          <AttentionNote>
            Indeterminate identification — no genus-level taxon record
          </AttentionNote>
        </header>
        <Illustration
          taxonName={fallbackName}
          images={[]}
          silhouette={silhouetteForTaxon(
            occurrences[0]?.taxonId ?? "",
            taxaById,
          )}
          phylopicSilhouette={null}
        />
        <p className={styles.block}>
          <span className="mono">{occurrences.length}</span> occurrence(s)
          recorded under this identification.
        </p>
      </section>
    );
  }

  const validity = taxon.validity.value;
  const isMinimal = profile?.contentLevel === "OccurrenceOnly";
  const enrichment = profile?.enrichment ?? null;
  const galleryImages = profile?.images ?? [];
  const silhouette = silhouetteForTaxon(taxonId, taxaById);
  const phylopicSilhouette = profile?.silhouette ?? null;
  const period = periodForRange(range);

  const pbdbLength = profile?.measurements.find((m) => m.kind === "BodyLength");
  const bodyLengthM =
    enrichment?.bodyLength?.value ??
    (pbdbLength && pbdbLength.value.value !== null
      ? pbdbLength.value.value
      : null);
  const pbdbDiet =
    profile?.attributes.find((a) => a.kind === "Diet")?.value.value ?? null;

  return (
    <section
      className={styles.profile}
      aria-label={`Taxon profile: ${taxon.scientificName}`}
    >
      <div className={styles.topbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to map
        </button>
        <TaxonomyTree
          taxonId={taxonId}
          taxaById={taxaById}
          onOpenTaxon={onOpenTaxon}
        />
      </div>

      <header className={styles.idHeader}>
        <h1 className={`sciName ${styles.idName}`}>
          {taxon.scientificName}
          {enrichment?.commonName && (
            <span className={styles.idCommon}>{enrichment.commonName}</span>
          )}
        </h1>
        {enrichment?.oneLiner && (
          <p className={styles.idOneLiner}>{enrichment.oneLiner}</p>
        )}
        <div className={styles.idMeta}>
          {period && (
            <span className={styles.periodTag}>
              <span
                className={styles.periodDot}
                style={{ background: period.colour }}
              />
              {period.name}
            </span>
          )}
          {range && (
            <>
              <span className={styles.metaSep}>·</span>
              <span className="mono">{formatMaRange(range)}</span>
            </>
          )}
          <span className={styles.metaSep}>·</span>
          <span>{taxon.rank}</span>
          <span className={styles.metaSep}>·</span>
          {validity && validity !== "Valid" ? (
            <AttentionNote>
              {validity}
              {taxon.acceptedPer ? ` — per ${taxon.acceptedPer}` : ""}
            </AttentionNote>
          ) : (
            <span className={styles.valid}>
              Valid{taxon.acceptedPer ? ` · per ${taxon.acceptedPer}` : ""}
            </span>
          )}
        </div>
        {isMinimal && (
          <AttentionNote>Occurrence only — minimal profile</AttentionNote>
        )}
      </header>

      <div className={styles.heroGrid}>
        <Illustration
          taxonName={taxon.scientificName}
          images={galleryImages}
          silhouette={silhouette}
          phylopicSilhouette={phylopicSilhouette}
        />
        <TaxonSpecTable
          taxonName={taxon.scientificName}
          enrichment={enrichment}
          pbdbDiet={pbdbDiet}
          range={range}
          occurrenceCount={totalCount}
          bodyLengthM={bodyLengthM}
          silhouette={phylopicSilhouette}
        />
      </div>

      {enrichment ? (
        <TaxonEnrichment enrichment={enrichment} />
      ) : profile?.summary?.value ? (
        <div className={styles.block}>
          <h3 className={styles.sectionH}>About</h3>
          <p className={styles.blurb}>{profile.summary.value}</p>
        </div>
      ) : null}

      {/* SPEC-014 REQ-007: occurrences collapsed behind a summary. */}
      <details className={styles.block}>
        <summary className={styles.collapsibleHead}>
          <span>Fossil occurrences ({totalCount})</span>
          <span className={styles.occSummary}>
            {" "}
            · {formationCount} formation{formationCount === 1 ? "" : "s"} ·
            recorded span <span className="mono">{formatMaRange(range)}</span> —
            expand
          </span>
        </summary>
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
      </details>
    </section>
  );
}
