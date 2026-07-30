/**
 * Taxon page (SPEC-014 REQ-005 as replaced by AMEND-005). The curated "spec
 * sheet" is retired: the page is now the taxon's **inline Wikipedia article** in
 * an `<iframe>`, under "← Back to map" and the taxonomy breadcrumb (retained for
 * lineage context and ancestor navigation, filtered by the same Wikipedia gate).
 *
 * The iframe loads the **build-time-resolved canonical URL** (`taxon.wikipedia`),
 * never a runtime title guess. Only taxa with an article are reachable here, so
 * the no-article branch is a defensive fallback. This is the deliberate, scoped
 * exception to DATA-005 (see SPEC-001): the embedded article is fetched by the
 * browser at runtime for display only.
 */

import type { ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import { AttentionNote } from "./Cues.js";
import { TaxonomyTree } from "./TaxonomyTree.js";
import styles from "./exploration.module.css";

interface TaxonProfileProps {
  api: ReadApi;
  taxonId: string;
  onBack: () => void;
  /** Open another taxon's page (AMEND-005: navigable, filtered ancestor links). */
  onOpenTaxon: (taxonId: string) => void;
}

export function TaxonProfile({
  api,
  taxonId,
  onBack,
  onOpenTaxon,
}: TaxonProfileProps): ReactElement {
  const taxon = api.getTaxon(taxonId);
  const taxaById = new Map(api.listTaxa().map((t) => [t.id, t]));
  const name = taxon?.scientificName ?? "Unavailable";
  const wikipedia = taxon?.wikipedia ?? null;
  // Embed the mobile article for a cleaner inline read; the stored canonical URL
  // is the desktop one (AMEND-005).
  const embedSrc = wikipedia
    ? wikipedia.url.replace("://en.wikipedia.org/", "://en.m.wikipedia.org/")
    : null;

  return (
    <section className={styles.profile} aria-label={`Taxon page: ${name}`}>
      <div className={styles.topbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to map
        </button>
        {taxon && (
          <TaxonomyTree
            taxonId={taxonId}
            taxaById={taxaById}
            onOpenTaxon={onOpenTaxon}
          />
        )}
      </div>

      {embedSrc ? (
        <iframe
          className={styles.wikiFrame}
          src={embedSrc}
          title={`Wikipedia article: ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <AttentionNote>
          No Wikipedia article for this taxon — no page is available.
        </AttentionNote>
      )}
    </section>
  );
}
