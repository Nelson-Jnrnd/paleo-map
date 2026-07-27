/**
 * Taxon-profile illustration (SPEC-012 → SPEC-014 REQ-003/004/005, AMEND-002). A
 * large lead image with a thumbnail strip to switch it; the image's type, credit,
 * licence and Commons link are revealed on hover/focus (a persistent ⓘ marks that
 * provenance is there — AMEND-002). When no showable image exists it falls back
 * to the taxon's bundled PhyloPic silhouette, else a generic clade silhouette.
 */

import { useState, type ReactElement } from "react";
import type { ImageType, ReadImage } from "../../domain/index.js";
import type { CladeSilhouette } from "./cladeSilhouette.js";
import styles from "./exploration.module.css";

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
}

function SilhouetteFallback({
  src,
  alt,
  note,
}: {
  src: string;
  alt: string;
  note: string;
}): ReactElement {
  return (
    <figure className={styles.leadFigure}>
      <div className={styles.silhouetteBox}>
        <img className={styles.silhouetteImg} src={src} alt={alt} loading="lazy" />
      </div>
      <figcaption className={styles.source}>{note}</figcaption>
    </figure>
  );
}

export function Illustration({
  taxonName,
  images,
  silhouette,
  phylopicSilhouette,
}: IllustrationProps): ReactElement {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [leadIdx, setLeadIdx] = useState(0);
  const shown = images.filter(
    (img) => img.imageUrl && !failed.has(img.imageUrl),
  );

  if (shown.length === 0) {
    return phylopicSilhouette ? (
      <SilhouetteFallback
        src={phylopicSilhouette}
        alt={`Silhouette of ${taxonName}`}
        note="Silhouette (PhyloPic) — not a photograph of this taxon"
      />
    ) : (
      <SilhouetteFallback
        src={silhouette.src}
        alt={`Generic ${silhouette.group} silhouette`}
        note={`Generic ${silhouette.group} silhouette — not a photograph of this taxon`}
      />
    );
  }

  const lead = shown[Math.min(leadIdx, shown.length - 1)]!;

  return (
    <div className={styles.galleryWrap}>
      <figure className={styles.leadFigure}>
        <div className={styles.leadFrame}>
          <img
            className={styles.leadImg}
            src={lead.imageUrl}
            alt={`${IMAGE_TYPE_LABEL[lead.type]} of ${taxonName}`}
            loading="lazy"
            onError={() =>
              setFailed((prev) => new Set(prev).add(lead.imageUrl))
            }
          />
          <span className={styles.credInfo} aria-hidden="true">
            i
          </span>
          <figcaption className={styles.credReveal}>
            {IMAGE_TYPE_LABEL[lead.type]} · {lead.credit} · {lead.licence} ·{" "}
            <a
              className={styles.credLink}
              href={lead.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Commons
            </a>
          </figcaption>
        </div>
      </figure>
      {shown.length > 1 && (
        <div className={styles.thumbStrip}>
          {shown.map((img, i) => (
            <button
              key={img.imageUrl}
              type="button"
              className={`${styles.thumb} ${i === Math.min(leadIdx, shown.length - 1) ? styles.thumbOn : ""}`}
              onClick={() => setLeadIdx(i)}
              aria-label={`Show ${IMAGE_TYPE_LABEL[img.type]}`}
              aria-pressed={i === leadIdx}
            >
              <img src={img.imageUrl} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
