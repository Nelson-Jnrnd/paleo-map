/**
 * Map multi-species card (SPEC-015 AMEND-002 #3). When occurrences pile up at the
 * same place, the map keeps them as one aggregate marker; clicking it opens this
 * card, which lists **every distinct species there**, each row opening that
 * taxon's page. A DOM overlay (no bundled glyphs needed), interactive (pinned).
 */

import type { ReactElement } from "react";
import styles from "./exploration.module.css";

export interface SpeciesRow {
  taxonId: string;
  taxon: string;
  clade: string;
  iconSrc: string;
  /** Whether this taxon has a page (article) — greys the row if not. */
  hasPage: boolean;
}

interface MapSpeciesCardProps {
  species: readonly SpeciesRow[];
  x: number;
  y: number;
  onOpenProfile: (taxonId: string) => void;
  onClose: () => void;
}

export function MapSpeciesCard({
  species,
  x,
  y,
  onOpenProfile,
  onClose,
}: MapSpeciesCardProps): ReactElement {
  return (
    <div
      className={styles.speciesCard}
      style={{ left: x, top: y }}
      role="dialog"
      aria-label={`${species.length} species here`}
    >
      <div className={styles.speciesHead}>
        <span>{species.length} species here</span>
        <button
          type="button"
          className={styles.mapHoverClose}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <ul className={styles.speciesList}>
        {species.map((s) =>
          s.hasPage ? (
            <li key={s.taxonId}>
              <button
                type="button"
                className={styles.speciesRow}
                onClick={() => onOpenProfile(s.taxonId)}
              >
                <img className={styles.speciesIcon} src={s.iconSrc} alt="" />
                <span className={`sciName ${styles.speciesName}`}>
                  {s.taxon}
                </span>
                <span className={styles.speciesClade}>{s.clade}</span>
              </button>
            </li>
          ) : (
            <li key={s.taxonId}>
              <span
                className={`${styles.speciesRow} ${styles.speciesRowDisabled}`}
                title="No Wikipedia article for this taxon"
              >
                <img className={styles.speciesIcon} src={s.iconSrc} alt="" />
                <span className={`sciName ${styles.speciesName}`}>
                  {s.taxon}
                </span>
                <span className={styles.speciesClade}>{s.clade}</span>
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
