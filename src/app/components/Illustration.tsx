/**
 * Taxon-profile illustration (SPEC-012 → SPEC-014 REQ-003/004/005). Shows a
 * gallery of the taxon's licensed Wikipedia/Commons images — each with its type,
 * credit, licence and a Commons source link (provenance always visible, never
 * behind a hover). When no showable image exists (or they all fail to load) it
 * falls back to a clearly-labelled clade silhouette. An optional human-relative
 * size scale makes a body length tangible.
 */

import { useState, type ReactElement } from "react";
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
  /** The showable images for this taxon (licence + credit already guaranteed). */
  images: readonly ReadImage[];
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
  images,
  silhouette,
  bodyLengthM,
}: IllustrationProps): ReactElement {
  // Track images that fail to load so a broken URL drops out of the gallery
  // (and, if they all fail, we fall back to the silhouette).
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const shown = images.filter(
    (img) => img.imageUrl && !failed.has(img.imageUrl),
  );

  return (
    <div className={styles.section}>
      <span className={styles.statLabel}>Illustration</span>
      {shown.length > 0 ? (
        <div className={styles.gallery}>
          {shown.map((img) => (
            <figure key={img.imageUrl} className={styles.illustration}>
              <img
                className={styles.illustrationImg}
                src={img.imageUrl}
                alt={`${IMAGE_TYPE_LABEL[img.type]} of ${taxonName}`}
                loading="lazy"
                onError={() =>
                  setFailed((prev) => new Set(prev).add(img.imageUrl))
                }
              />
              <figcaption className={styles.illustrationCaption}>
                <span>{IMAGE_TYPE_LABEL[img.type]}</span>
                <span className={styles.source}>
                  {img.credit} · {img.licence} ·{" "}
                  <a
                    className={styles.sourceLink}
                    href={img.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Commons
                  </a>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
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
