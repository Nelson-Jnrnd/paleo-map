/**
 * Locality & Taxon detail panels (SPEC-010 REQ-003/004). Mirror the occurrence
 * panel's shape (SPEC-003 REQ-006). The locality panel lists the taxa recorded at
 * a collection, each reaching its profile; the taxon panel summarises a taxon at
 * the current rank tier and opens its full profile — while the map focuses the
 * taxon's whole point-set (the focus id-set is computed by the view). The
 * not-classified taxon bucket is inspected but has no single profile, and says so.
 */

import type { ReactElement } from "react";
import type { ReadOccurrence } from "../../domain/index.js";
import { formatMaRange } from "../format.js";
import type { LocalityGroup, TaxonGroup } from "../state/grouping.js";
import styles from "./exploration.module.css";

interface LocalityPanelProps {
  group: LocalityGroup;
  /** The occurrences recorded at this locality (for the taxa list). */
  occurrences: readonly ReadOccurrence[];
  onOpenProfile: (taxonId: string) => void;
  onClose: () => void;
}

export function LocalityPanel({
  group,
  occurrences,
  onOpenProfile,
  onClose,
}: LocalityPanelProps): ReactElement {
  // Distinct taxa recorded here, in stable name order.
  const seen = new Map<string, string>();
  for (const o of occurrences) if (!seen.has(o.taxonId)) seen.set(o.taxonId, o.taxonName);
  const taxa = [...seen.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1));

  return (
    <section className={styles.panel} aria-label={`Locality: ${group.name}`}>
      <div className={styles.panelHead}>
        <h2>{group.name}</h2>
        <button
          type="button"
          className={styles.panelClose}
          onClick={onClose}
          aria-label="Close locality panel"
        >
          ✕
        </button>
      </div>

      <dl className={styles.fieldGrid}>
        <dt className={styles.fieldLabel}>Formation</dt>
        <dd className={styles.fieldValue}>{group.formation ?? "—"}</dd>
        <dt className={styles.fieldLabel}>Time range</dt>
        <dd className={styles.fieldValue}>
          <span className="mono">
            {formatMaRange(
              group.minMa !== null && group.maxMa !== null
                ? { minMa: group.minMa, maxMa: group.maxMa }
                : null,
            )}
          </span>
        </dd>
        <dt className={styles.fieldLabel}>Taxa recorded</dt>
        <dd className={styles.fieldValue}>
          <span className="mono">{group.taxonCount}</span>
        </dd>
      </dl>

      <ul className={styles.list} aria-label="Taxa recorded at this locality">
        {taxa.map(([taxonId, taxonName]) => (
          <li key={taxonId}>
            <button
              type="button"
              className={styles.occurrenceRow}
              onClick={() => onOpenProfile(taxonId)}
            >
              <span className={`${styles.occurrenceTaxon} sciName`}>{taxonName}</span>
              <span className={styles.occurrenceMeta}>Open profile →</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TaxonPanelProps {
  group: TaxonGroup;
  onOpenProfile: (taxonId: string) => void;
  onClose: () => void;
}

export function TaxonPanel({
  group,
  onOpenProfile,
  onClose,
}: TaxonPanelProps): ReactElement {
  return (
    <section className={styles.panel} aria-label={`Taxon: ${group.name}`}>
      <div className={styles.panelHead}>
        <h2 className={group.notClassified ? undefined : "sciName"}>{group.name}</h2>
        <button
          type="button"
          className={styles.panelClose}
          onClick={onClose}
          aria-label="Close taxon panel"
        >
          ✕
        </button>
      </div>

      <dl className={styles.fieldGrid}>
        <dt className={styles.fieldLabel}>Occurrences in view</dt>
        <dd className={styles.fieldValue}>
          <span className="mono">{group.count}</span>
        </dd>
        <dt className={styles.fieldLabel}>Time range</dt>
        <dd className={styles.fieldValue}>
          <span className="mono">
            {formatMaRange(
              group.minMa !== null && group.maxMa !== null
                ? { minMa: group.minMa, maxMa: group.maxMa }
                : null,
            )}
          </span>
        </dd>
      </dl>

      {group.taxonId ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => onOpenProfile(group.taxonId!)}
        >
          Open taxon profile →
        </button>
      ) : (
        <p className={styles.source}>
          These records are identified only above this rank, so they have no single
          taxon profile. Choose a coarser rank to group them.
        </p>
      )}
    </section>
  );
}
