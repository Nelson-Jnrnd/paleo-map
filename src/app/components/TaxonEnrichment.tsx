/**
 * AI-assisted enrichment block on the taxon page (SPEC-014 REQ-001/005). Renders
 * the extract-don't-invent record distilled from the taxon's Wikipedia article: a
 * one-line "what it was", a fact row (length · height · mass · diet · era), a
 * plain-language blurb, and collapsible "Discovery & naming" and "Notable facts".
 *
 * Charter-bound (docs/mockups/design-guidelines.md): numbers are mono with units
 * and an explicit `estimated` cue so uncertainty stays legible (§2); missing facts
 * are simply omitted from the highlights row (the detailed biology block still
 * shows "Not available"); one quiet line discloses the AI assistance (NFR-002).
 */

import type { ReactElement } from "react";
import type {
  EnrichedMeasurement,
  EnrichmentRecord,
} from "../../domain/index.js";
import styles from "./exploration.module.css";

/** "12.4 m" (+ "12.3–13" range when given). Confidence is shown separately. */
function measureText(m: EnrichedMeasurement): string {
  const base = `${m.value} ${m.unit}`;
  return m.low !== null && m.high !== null
    ? `${base} · ${m.low}–${m.high}`
    : base;
}

interface ChipSpec {
  label: string;
  measure?: EnrichedMeasurement | null;
  text?: string | null;
}

function FactChip({ label, measure, text }: ChipSpec): ReactElement {
  return (
    <div className={styles.factChip}>
      <span className={styles.factChipLabel}>{label}</span>
      {measure ? (
        <span className={`${styles.factChipValue} mono`}>
          {measureText(measure)}
          {measure.confidence === "estimated" && (
            <span className={styles.factEst}> est.</span>
          )}
        </span>
      ) : (
        <span className={styles.factChipValue}>{text}</span>
      )}
    </div>
  );
}

export function TaxonEnrichment({
  enrichment,
}: {
  enrichment: EnrichmentRecord;
}): ReactElement {
  const e = enrichment;
  const discovery = e.discovery;
  const hasDiscovery =
    e.pronunciation ||
    e.nameMeaning ||
    (discovery && (discovery.year || discovery.who || discovery.where));
  const chips: ChipSpec[] = [
    { label: "Length", measure: e.bodyLength },
    { label: "Height", measure: e.height },
    { label: "Mass", measure: e.mass },
    { label: "Diet", text: e.diet },
    { label: "Era", text: e.era },
  ].filter((c) => c.measure || c.text);

  return (
    <div className={styles.section}>
      <span className={styles.statLabel}>Overview</span>

      {e.oneLiner && <p className={styles.oneLiner}>{e.oneLiner}</p>}

      {chips.length > 0 && (
        <div className={styles.factRow}>
          {chips.map((c) => (
            <FactChip key={c.label} {...c} />
          ))}
        </div>
      )}

      {e.description && <p className={styles.fieldValue}>{e.description}</p>}

      {hasDiscovery && (
        <details className={styles.collapsible}>
          <summary className={styles.collapsibleHead}>
            Discovery &amp; naming
          </summary>
          <dl className={styles.fieldGrid}>
            {e.pronunciation && (
              <div style={{ display: "contents" }}>
                <dt className={styles.fieldLabel}>Pronunciation</dt>
                <dd className={styles.fieldValue}>{e.pronunciation}</dd>
              </div>
            )}
            {e.nameMeaning && (
              <div style={{ display: "contents" }}>
                <dt className={styles.fieldLabel}>Name meaning</dt>
                <dd className={styles.fieldValue}>{e.nameMeaning}</dd>
              </div>
            )}
            {discovery &&
              (discovery.year || discovery.who || discovery.where) && (
                <div style={{ display: "contents" }}>
                  <dt className={styles.fieldLabel}>Discovered</dt>
                  <dd className={styles.fieldValue}>
                    {[
                      discovery.year !== null ? String(discovery.year) : null,
                      discovery.who,
                      discovery.where,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              )}
          </dl>
        </details>
      )}

      {e.notableFacts.length > 0 && (
        <details className={styles.collapsible}>
          <summary className={styles.collapsibleHead}>
            Notable facts ({e.notableFacts.length})
          </summary>
          <ul className={styles.factList}>
            {e.notableFacts.map((f, i) => (
              <li key={i} className={styles.factItem}>
                <span className={styles.factTag}>{f.tag}</span>
                <span className={styles.fieldValue}>{f.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className={styles.source}>
        AI-assisted — distilled from this taxon&rsquo;s Wikipedia article; facts
        not stated there are omitted, not invented.
      </p>
    </div>
  );
}
