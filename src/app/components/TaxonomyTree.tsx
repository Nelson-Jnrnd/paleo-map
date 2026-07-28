/**
 * Taxonomy breadcrumb (SPEC-014 REQ-006 / AMEND-002). The taxon's lineage as a
 * compact top-of-page navigation: `Dinosauria › Theropoda › ⋯ › Genus`, anchored
 * at Dinosauria (the atlas's scope root) with a long middle elided behind an
 * expandable ⋯. Ancestor names are links that open that taxon's profile; the
 * current taxon is the non-linked, emphasised tail. A taxon with no ancestry
 * renders nothing.
 */

import { useState, type ReactElement } from "react";
import type { ReadTaxon } from "../../domain/index.js";
import { taxonLineage } from "./lineage.js";
import styles from "./exploration.module.css";

const SCOPE_ROOT = "Dinosauria";
/** Show every crumb when the lineage is at most this long; otherwise elide. */
const ELIDE_ABOVE = 5;
/** When eliding, keep this many trailing crumbs (parent chain + current). */
const TAIL_KEEP = 2;

interface TaxonomyTreeProps {
  taxonId: string;
  taxaById: ReadonlyMap<string, ReadTaxon>;
  onOpenTaxon: (taxonId: string) => void;
}

export function TaxonomyTree({
  taxonId,
  taxaById,
  onOpenTaxon,
}: TaxonomyTreeProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const full = taxonLineage(taxonId, taxaById);
  const rootIdx = full.findIndex((t) => t.scientificName === SCOPE_ROOT);
  const lineage = rootIdx > 0 ? full.slice(rootIdx) : full;
  if (lineage.length < 2) return null;

  const elide = !expanded && lineage.length > ELIDE_ABOVE;
  // When eliding: first crumb, then a ⋯ expander, then the last TAIL_KEEP crumbs.
  const head = elide ? lineage.slice(0, 1) : lineage;
  const tail = elide ? lineage.slice(lineage.length - TAIL_KEEP) : [];

  const crumb = (t: ReadTaxon): ReactElement => {
    const isCurrent = t.id === taxonId;
    return isCurrent ? (
      <span key={t.id} className={`sciName ${styles.crumbCurrent}`}>
        {t.scientificName}
      </span>
    ) : (
      <button
        key={t.id}
        type="button"
        className={styles.crumbLink}
        onClick={() => onOpenTaxon(t.id)}
      >
        <span className="sciName">{t.scientificName}</span>
      </button>
    );
  };

  const sep = (k: string): ReactElement => (
    <span key={k} className={styles.crumbSep} aria-hidden="true">
      ›
    </span>
  );

  const parts: ReactElement[] = [];
  head.forEach((t, i) => {
    if (i > 0) parts.push(sep(`hs${i}`));
    parts.push(crumb(t));
  });
  if (elide) {
    parts.push(sep("es"));
    parts.push(
      <button
        key="more"
        type="button"
        className={styles.crumbMore}
        onClick={() => setExpanded(true)}
        aria-label={`Show ${lineage.length - 1 - TAIL_KEEP} more clades`}
      >
        ⋯
      </button>,
    );
    tail.forEach((t) => {
      parts.push(sep(`ts${t.id}`));
      parts.push(crumb(t));
    });
  }

  return (
    <nav className={styles.crumbs} aria-label="Taxonomy">
      {parts}
    </nav>
  );
}
