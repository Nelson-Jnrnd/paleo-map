/**
 * Taxon-profile illustration (SPEC-012 → SPEC-014 REQ-003/004/005). Shows a
 * gallery of the taxon's licensed Wikipedia/Commons images — each with its type,
 * credit, licence and a Commons source link (provenance always visible, never
 * behind a hover). When no showable image exists it falls back to the taxon's
 * bundled PhyloPic silhouette (or a generic clade silhouette). A size-vs-human
 * hero scales that silhouette against a human to make a body length tangible.
 */

import { useState, type ReactElement } from "react";
import type { ImageType, ReadImage } from "../../domain/index.js";
import type { CladeSilhouette } from "./cladeSilhouette.js";
import styles from "./exploration.module.css";

/** Rough reference stature for the size comparison (metres). */
const HUMAN_HEIGHT_M = 1.7;
/** Bundled Homo sapiens silhouette for the size hero (SPEC-014 REQ-004). */
const HUMAN_SILHOUETTE = "data/silhouettes/human.svg";
/** Layout budgets (px) for the silhouette hero: dino length, human height. */
const HERO_MAX_W = 240;
const HERO_MAX_H = 170;

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
  /** Generic group silhouette used when there is no taxon silhouette or image. */
  silhouette: CladeSilhouette;
  /** Bundled PhyloPic silhouette path for this taxon, or null (SPEC-014 REQ-004). */
  phylopicSilhouette: string | null;
  /** Body length in metres, or null when unknown (no invented number). */
  bodyLengthM: number | null;
}

/** Bar comparison — the fallback when no silhouette is available. */
function SizeBars({
  taxonName,
  lengthM,
}: {
  taxonName: string;
  lengthM: number;
}): ReactElement {
  const maxM = Math.max(lengthM, HUMAN_HEIGHT_M);
  return (
    <div
      className={styles.sizeBars}
      role="img"
      aria-label={`${taxonName} is about ${lengthM} metres long, compared with a ${HUMAN_HEIGHT_M} metre human.`}
    >
      <span className={styles.sizeRow}>
        <span
          className={styles.sizeBarDino}
          style={{ width: `${(lengthM / maxM) * 100}%` }}
        />
        <span className={`${styles.sizeBarValue} mono`}>{lengthM} m</span>
      </span>
      <span className={styles.sizeRow}>
        <span
          className={styles.sizeBarHuman}
          style={{ width: `${(HUMAN_HEIGHT_M / maxM) * 100}%` }}
        />
        <span className={`${styles.sizeBarValue} mono`}>
          {HUMAN_HEIGHT_M} m human
        </span>
      </span>
    </div>
  );
}

/**
 * Size-vs-human hero: the taxon silhouette scaled to its body length beside a
 * human scaled to 1.7 m on the same px-per-metre scale (SPEC-014 REQ-004). Falls
 * back to bars when no silhouette is available.
 */
function SizeHero({
  taxonName,
  lengthM,
  dinoSilhouette,
}: {
  taxonName: string;
  lengthM: number;
  dinoSilhouette: string | null;
}): ReactElement {
  return (
    <div className={styles.sizeScale}>
      <span className={styles.statLabel}>Size vs human</span>
      {dinoSilhouette ? (
        (() => {
          const pxPerM = Math.min(
            HERO_MAX_W / lengthM,
            HERO_MAX_H / HUMAN_HEIGHT_M,
          );
          return (
            <div
              className={styles.sizeHeroStage}
              role="img"
              aria-label={`${taxonName} is about ${lengthM} metres long, shown to scale beside a ${HUMAN_HEIGHT_M} metre human.`}
            >
              <figure className={styles.sizeHeroFig}>
                <img
                  className={styles.sizeHeroDino}
                  src={dinoSilhouette}
                  alt=""
                  style={{ width: `${lengthM * pxPerM}px` }}
                />
                <figcaption className={`${styles.sizeHeroCap} mono`}>
                  {lengthM} m
                </figcaption>
              </figure>
              <figure className={styles.sizeHeroFig}>
                <img
                  className={styles.sizeHeroHuman}
                  src={HUMAN_SILHOUETTE}
                  alt=""
                  style={{ height: `${HUMAN_HEIGHT_M * pxPerM}px` }}
                />
                <figcaption className={`${styles.sizeHeroCap} mono`}>
                  {HUMAN_HEIGHT_M} m
                </figcaption>
              </figure>
            </div>
          );
        })()
      ) : (
        <SizeBars taxonName={taxonName} lengthM={lengthM} />
      )}
    </div>
  );
}

export function Illustration({
  taxonName,
  images,
  silhouette,
  phylopicSilhouette,
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
      ) : phylopicSilhouette ? (
        <figure className={styles.illustration}>
          <img
            className={styles.silhouetteImg}
            src={phylopicSilhouette}
            alt={`Silhouette of ${taxonName}`}
            loading="lazy"
          />
          <figcaption className={styles.illustrationCaption}>
            <span className={styles.source}>
              Silhouette (PhyloPic) — not a photograph of this taxon
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
        <SizeHero
          taxonName={taxonName}
          lengthM={bodyLengthM}
          dinoSilhouette={phylopicSilhouette}
        />
      )}
    </div>
  );
}
