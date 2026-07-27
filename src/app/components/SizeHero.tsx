/**
 * Size-vs-human hero (SPEC-014 REQ-004). The taxon silhouette scaled to its body
 * length beside a human scaled to 1.7 m on the same px-per-metre scale; falls
 * back to a simple bar comparison when no silhouette is available. Compact, so it
 * sits under the spec table in the taxon page's data column (AMEND-002).
 */

import type { ReactElement } from "react";
import styles from "./exploration.module.css";

const HUMAN_HEIGHT_M = 1.7;
const HUMAN_SILHOUETTE = "data/silhouettes/human.svg";
/** Layout budgets (px): dino length, human height. */
const HERO_MAX_W = 210;
const HERO_MAX_H = 150;

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

export function SizeHero({
  taxonName,
  lengthM,
  dinoSilhouette,
}: {
  taxonName: string;
  lengthM: number;
  dinoSilhouette: string | null;
}): ReactElement {
  const pxPerM = Math.min(HERO_MAX_W / lengthM, HERO_MAX_H / HUMAN_HEIGHT_M);
  return (
    <div className={styles.sizeScale}>
      <span className={styles.specCaption}>Size vs human</span>
      {dinoSilhouette ? (
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
      ) : (
        <SizeBars taxonName={taxonName} lengthM={lengthM} />
      )}
    </div>
  );
}
