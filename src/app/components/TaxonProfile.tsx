/**
 * EXPERIMENTAL SPIKE — inlined Wikipedia article via <iframe>.
 *
 * ⚠️ This deliberately violates the project's specs and is NOT mergeable as-is:
 *   - It breaks the no-runtime-egress rule (SPEC-001 / DATA-005): the iframe
 *     fetches en.m.wikipedia.org live at runtime.
 *   - It abandons the designed "spec sheet" profile layout (SPEC-014 REQ-005)
 *     and the cartographic design charter (design-guidelines.md).
 *   - It breaks the existing profile UI tests (they assert the old layout).
 *
 * It exists only on this branch to see how a Wikipedia-native inline article
 * feels. The previous, spec-compliant implementation is in git history.
 */

import type { ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import styles from "./exploration.module.css";

interface TaxonProfileProps {
  api: ReadApi;
  taxonId: string;
  onBack: () => void;
  /** Kept for signature compatibility; unused in this spike. */
  onOpenTaxon: (taxonId: string) => void;
}

/** Best-effort Wikipedia article title from a taxon (genus name → article). */
function wikipediaTitle(name: string): string {
  return name.trim().replace(/\s+/g, "_");
}

export function TaxonProfile({
  api,
  taxonId,
  onBack,
}: TaxonProfileProps): ReactElement {
  const taxon = api.getTaxon(taxonId);
  const occurrences = api.listOccurrences({ taxonId });
  const name =
    taxon?.scientificName ?? occurrences[0]?.taxonName ?? "Special:BlankPage";
  const src = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(
    wikipediaTitle(name),
  )}`;

  return (
    <section
      className={styles.profile}
      aria-label={`Wikipedia article: ${name}`}
    >
      <div className={styles.topbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to map
        </button>
      </div>
      <p className={styles.source}>
        Experimental inline Wikipedia embed (live, off-spec) —{" "}
        <span className="sciName">{name}</span>
      </p>
      <iframe
        className={styles.wikiFrame}
        src={src}
        title={`Wikipedia article for ${name}`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </section>
  );
}
