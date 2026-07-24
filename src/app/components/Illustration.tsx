/**
 * Taxon-profile illustration (SPEC-012 REQ-003/004/005). Shows the licensed
 * Wikipedia/Commons lead image with its type, credit, licence and a source link
 * — provenance always visible, never behind a hover (charter §4/§5, FONC-1190/
 * 1200). When no showable image exists (or it fails to load) it falls back to a
 * generic, clearly-labelled clade silhouette (FONC-1240). An optional
 * human-relative size scale makes a body length tangible.
 */

import { useState, type ReactElement, type ReactNode } from "react";
import type { ImageType, ReadImage } from "../../domain/index.js";
import type { CladeSilhouette } from "./cladeSilhouette.js";
import styles from "./exploration.module.css";

/** Rough reference stature for the size comparison (metres). */
const HUMAN_HEIGHT_M = 1.7;

const IMAGE_TYPE_LABEL: Readonly<Record<ImageType, string>> = {
  FossilPhoto: "Fossil photo",
  SkeletalMount: "Skeletal mount",
  ArtisticReconstruction: "Artistic reconstruction",
  Silhouette: "Silhouette",
};

interface IllustrationProps {
  taxonName: string;
  /** The lead showable image, if any (licence + credit already guaranteed). */
  image: ReadImage | undefined;
  /** The Commons source-page link node for the image's source. */
  imageSource: ReactNode;
  /** Generic group silhouette used when there is no showable image. */
  silhouette: CladeSilhouette;
  /** Body length in metres, or null when unknown (no invented number). */
  bodyLengthM: number | null;
}

function SizeScale({
  taxonName,
  lengthM,
}: {
  taxonName: string;
  lengthM: number;
}): ReactElement {
  const maxM = Math.max(lengthM, HUMAN_HEIGHT_M);
  const dinoPct = (lengthM / maxM) * 100;
  const humanPct = (HUMAN_HEIGHT_M / maxM) * 100;
  return (
    <div className={styles.sizeScale}>
      <span className={styles.statLabel}>Size vs human</span>
      <div
        className={styles.sizeBars}
        role="img"
        aria-label={`${taxonName} is about ${lengthM} metres long, compared with a ${HUMAN_HEIGHT_M} metre human.`}
      >
        <span className={styles.sizeRow}>
          <span
            className={styles.sizeBarDino}
            style={{ width: `${dinoPct}%` }}
          />
          <span className={`${styles.sizeBarValue} mono`}>{lengthM} m</span>
        </span>
        <span className={styles.sizeRow}>
          <span
            className={styles.sizeBarHuman}
            style={{ width: `${humanPct}%` }}
          />
          <span className={`${styles.sizeBarValue} mono`}>
            {HUMAN_HEIGHT_M} m human
          </span>
        </span>
      </div>
    </div>
  );
}

export function Illustration({
  taxonName,
  image,
  imageSource,
  silhouette,
  bodyLengthM,
}: IllustrationProps): ReactElement {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(image?.imageUrl) && !imageFailed;

  return (
    <div className={styles.section}>
      <span className={styles.statLabel}>Illustration</span>
      {showImage && image ? (
        <figure className={styles.illustration}>
          <img
            className={styles.illustrationImg}
            src={image.imageUrl}
            alt={`${IMAGE_TYPE_LABEL[image.type]} of ${taxonName}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
          <figcaption className={styles.illustrationCaption}>
            <span>{IMAGE_TYPE_LABEL[image.type]}</span>
            <span className={styles.source}>
              {image.credit} · {image.licence} · {imageSource}
            </span>
          </figcaption>
        </figure>
      ) : (
        <figure className={styles.illustration}>
          <img
            className={styles.silhouetteImg}
            src={silhouette.src}
            alt={`Generic ${silhouette.group} silhouette`}
            loading="lazy"
          />
          <figcaption className={styles.illustrationCaption}>
            <span className={styles.source}>
              Generic {silhouette.group} silhouette — not a photograph of this
              taxon
            </span>
          </figcaption>
        </figure>
      )}
      {bodyLengthM !== null && bodyLengthM > 0 && (
        <SizeScale taxonName={taxonName} lengthM={bodyLengthM} />
      )}
    </div>
  );
}
