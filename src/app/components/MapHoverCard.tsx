/**
 * Map hover preview card (SPEC-015 REQ-003). A compact, non-interactive card
 * shown near the pointer when a marker is hovered, so the taxon's identity and key
 * facts arrive **before** any click. Rendered as a DOM overlay (not a MapLibre
 * symbol) so it needs no bundled glyphs and stays offline (SEC-001). The content
 * builder is pure and unit-tested; the positioning wrapper is presentational.
 */

import type { ReactElement } from "react";
import type { ReadOccurrence } from "../../domain/index.js";
import { formatMaRange, NOT_AVAILABLE } from "../format.js";
import styles from "./exploration.module.css";

export interface HoverCardContent {
  taxon: string;
  clade: string;
  age: string;
  formation: string;
}

/** Build the hover card's fields from an occurrence + its clade label (pure). */
export function hoverCardContent(
  occurrence: ReadOccurrence,
  cladeLabel: string,
): HoverCardContent {
  return {
    taxon: occurrence.taxonName,
    clade: cladeLabel,
    age: formatMaRange(occurrence.timeRange.value),
    formation: occurrence.formation ?? NOT_AVAILABLE,
  };
}

interface MapHoverCardProps {
  content: HoverCardContent;
  /** Pixel position of the marker within the map container. */
  x: number;
  y: number;
  /** Clade icon URL for the little glyph on the card. */
  iconSrc: string;
  /**
   * SPEC-015 AMEND-001 (#3): when pinned (clicked), the card is interactive —
   * it stays open, offers "Open taxon profile", and can be closed. When not
   * pinned it is a passive hover tooltip.
   */
  pinned?: boolean;
  onOpenProfile?: (() => void) | undefined;
  onClose?: () => void;
}

export function MapHoverCard({
  content,
  x,
  y,
  iconSrc,
  pinned = false,
  onOpenProfile,
  onClose,
}: MapHoverCardProps): ReactElement {
  return (
    <div
      className={`${styles.mapHoverCard} ${pinned ? styles.mapHoverPinned : ""}`}
      style={{ left: x, top: y }}
      role={pinned ? "dialog" : "tooltip"}
      aria-hidden={pinned ? undefined : "true"}
      aria-label={pinned ? `${content.taxon} details` : undefined}
    >
      {pinned && onClose && (
        <button
          type="button"
          className={styles.mapHoverClose}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      )}
      <div className={styles.mapHoverTop}>
        <img className={styles.mapHoverIcon} src={iconSrc} alt="" />
        <div className={styles.mapHoverBody}>
          <span className={`sciName ${styles.mapHoverTaxon}`}>
            {content.taxon}
          </span>
          <span className={styles.mapHoverMeta}>{content.clade}</span>
          <span className={styles.mapHoverMeta}>
            <span className="mono">{content.age}</span>
          </span>
          <span className={styles.mapHoverMeta}>{content.formation}</span>
        </div>
      </div>
      {pinned && onOpenProfile && (
        <button
          type="button"
          className={styles.mapHoverAction}
          onClick={onOpenProfile}
        >
          Open taxon profile →
        </button>
      )}
    </div>
  );
}
