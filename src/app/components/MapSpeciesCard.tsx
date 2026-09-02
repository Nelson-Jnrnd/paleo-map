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
  /**
   * SPEC-027 REQ-005: select the taxon on the map. Supplied in Taxon mode, where
   * selection — not the profile — is the mode's unit, so it becomes the row's
   * action and the profile moves to a secondary link. Absent in Occurrence mode,
   * where the row keeps opening the profile as before.
   */
  onSelectTaxon?: ((taxonId: string) => void) | undefined;
  onClose: () => void;
}

export function MapSpeciesCard({
  species,
  x,
  y,
  onOpenProfile,
  onSelectTaxon,
  onClose,
}: MapSpeciesCardProps): ReactElement {
  return (
    <div
      className={styles.speciesCard}
      // SPEC-030 UX-002: the cluster's identity carrier (SPEC-027 REQ-005).
      // A tap on a cluster answers "what is this" with this card, exactly as a
      // tap on a single marker does with the hover card.
      data-map-card="cluster"
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
        {species.map((s) => {
          const body = (
            <>
              <img className={styles.speciesIcon} src={s.iconSrc} alt="" />
              <span className={`sciName ${styles.speciesName}`}>{s.taxon}</span>
              <span className={styles.speciesClade}>{s.clade}</span>
            </>
          );

          // Taxon mode: the row selects, and the profile — which needs an
          // article — steps back to a secondary link. Selection has no such
          // precondition, so every row stays actionable here.
          if (onSelectTaxon) {
            return (
              <li key={s.taxonId} className={styles.speciesItem}>
                <button
                  type="button"
                  className={styles.speciesRow}
                  aria-label={`Select ${s.taxon}`}
                  onClick={() => onSelectTaxon(s.taxonId)}
                >
                  {body}
                </button>
                {s.hasPage && (
                  <button
                    type="button"
                    className={styles.speciesProfile}
                    aria-label={`Open ${s.taxon} profile`}
                    onClick={() => onOpenProfile(s.taxonId)}
                  >
                    Profile →
                  </button>
                )}
              </li>
            );
          }

          return s.hasPage ? (
            <li key={s.taxonId}>
              <button
                type="button"
                className={styles.speciesRow}
                onClick={() => onOpenProfile(s.taxonId)}
              >
                {body}
              </button>
            </li>
          ) : (
            <li key={s.taxonId}>
              <span
                className={`${styles.speciesRow} ${styles.speciesRowDisabled}`}
                title="No Wikipedia article for this taxon"
              >
                {body}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
