/**
 * Taxonomy tree (SPEC-014 REQ-006). Renders the taxon's position in the tree as
 * its lineage up the parent chain (e.g. Dinosauria › Saurischia › Theropoda › …
 * › Genus). Ancestor names are links that open that taxon's profile; the current
 * taxon is the non-linked tail. Built from `parentId` alone (no new data). A
 * taxon with no parent record degrades to just itself.
 *
 * Charter-bound: scientific names are italic (§3, CONS-350); ranks are a quiet
 * secondary cue; the separator is a plain chevron, no decoration.
 */

import type { ReactElement } from "react";
import type { ReadTaxon } from "../../domain/index.js";
import { taxonLineage } from "./lineage.js";
import styles from "./exploration.module.css";

interface TaxonomyTreeProps {
  taxonId: string;
  taxaById: ReadonlyMap<string, ReadTaxon>;
  onOpenTaxon: (taxonId: string) => void;
}

/**
 * The atlas is scoped to Dinosauria, so the lineage is anchored there: the
 * higher clades (Chordata, Vertebrata, …) are noise for this audience. If the
 * scope root isn't in the chain, the full lineage is shown.
 */
const SCOPE_ROOT = "Dinosauria";

export function TaxonomyTree({
  taxonId,
  taxaById,
  onOpenTaxon,
}: TaxonomyTreeProps): ReactElement | null {
  const full = taxonLineage(taxonId, taxaById);
  const rootIdx = full.findIndex((t) => t.scientificName === SCOPE_ROOT);
  const lineage = rootIdx > 0 ? full.slice(rootIdx) : full;
  // Only itself (or nothing) resolved — no ancestry to show.
  if (lineage.length < 2) return null;

  return (
    <div className={styles.section}>
      <span className={styles.statLabel}>Taxonomy</span>
      <ol className={styles.lineage} aria-label="Taxonomic lineage">
        {lineage.map((t, i) => {
          const isCurrent = t.id === taxonId;
          return (
            <li key={t.id} className={styles.lineageItem}>
              {i > 0 && (
                <span className={styles.lineageSep} aria-hidden="true">
                  ›
                </span>
              )}
              {isCurrent ? (
                <span className={`sciName ${styles.lineageCurrent}`}>
                  {t.scientificName}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.lineageLink}
                  onClick={() => onOpenTaxon(t.id)}
                >
                  <span className="sciName">{t.scientificName}</span>
                  <span className={styles.lineageRank}> · {t.rank}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
