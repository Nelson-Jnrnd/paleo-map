/**
 * Taxon "About" block (SPEC-014 REQ-001/005, AMEND-002). The plain-language blurb
 * distilled from the taxon's Wikipedia article, then the notable facts as quiet
 * prose (no tag chips), then a collapsible "Discovery & naming". The one-liner
 * now leads the identity header, the numeric facts live in the spec table, and
 * the AI disclosure sits in the page footer — so this block is just the reading
 * content. Extract-don't-invent: absent fields are omitted (NFR-002).
 */

import type { ReactElement } from "react";
import type { EnrichmentRecord } from "../../domain/index.js";
import styles from "./exploration.module.css";

export function TaxonEnrichment({
  enrichment,
}: {
  enrichment: EnrichmentRecord;
}): ReactElement {
  const e = enrichment;
  const d = e.discovery;
  const hasDiscovery =
    e.pronunciation || e.nameMeaning || (d && (d.year || d.who || d.where));

  return (
    <div className={styles.block}>
      <h3 className={styles.sectionH}>About</h3>
      {e.description && <p className={styles.blurb}>{e.description}</p>}

      {e.notableFacts.length > 0 && (
        <ul className={styles.notables}>
          {e.notableFacts.map((f, i) => (
            <li key={i}>{f.text}</li>
          ))}
        </ul>
      )}

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
            {d && (d.year || d.who || d.where) && (
              <div style={{ display: "contents" }}>
                <dt className={styles.fieldLabel}>Discovered</dt>
                <dd className={styles.fieldValue}>
                  {[d.year !== null ? String(d.year) : null, d.who, d.where]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}
