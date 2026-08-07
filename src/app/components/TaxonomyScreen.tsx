/**
 * The dedicated taxonomy screen (SPEC-017). The five surfaces need room — the
 * clade sheet and the fan in particular are too large for the exploration side
 * panel and would fight the Wikipedia embed on the taxon page — so they get a
 * screen of their own, reached from the map loop and returning to it in one
 * action (OQ-040).
 *
 * Everything shown is rooted at `Dinosauria` (REQ-001): the 34-node stem above
 * it stays in the snapshot and is simply not a surface here.
 */

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import { buildTaxonomyIndex } from "../state/taxonomy.js";
import { searchTaxa } from "../state/search.js";
import type { SearchableTaxon } from "../state/search.js";
import {
  AvianMark,
  CladeFan,
  CladeSheet,
  CommonAncestor,
  LineageDescent,
  TaxonNeighbours,
  pluralGenera,
} from "./TaxonomySurfaces.js";
import type { TaxonomyDeps } from "./TaxonomySurfaces.js";
import styles from "./exploration.module.css";

interface TaxonomyScreenProps {
  api: ReadApi;
  /** The taxon in focus. Falls back to the scope root when out of scope. */
  taxonId: string | null;
  onBack: () => void;
  onSelectTaxon: (taxonId: string) => void;
  /** Open the taxon's page (the Wikipedia embed) — kept as a distinct action. */
  onOpenProfile?: (taxonId: string) => void;
}

export function TaxonomyScreen({
  api,
  taxonId,
  onBack,
  onSelectTaxon,
  onOpenProfile,
}: TaxonomyScreenProps): ReactElement {
  const index = useMemo(() => buildTaxonomyIndex(api.listTaxa()), [api]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const searchIndex = useMemo<SearchableTaxon[]>(
    () =>
      api
        .listTaxa()
        .filter((t) => index.inScope(t.id))
        .map((t) => ({
          taxonId: t.id,
          scientificName: t.scientificName,
          commonName: api.getProfile(t.id)?.commonName?.value ?? null,
          contentLevel: api.getProfile(t.id)?.contentLevel ?? "OccurrenceOnly",
        })),
    [api, index],
  );

  const deps: TaxonomyDeps = {
    index,
    profileOf: (id) => api.getProfile(id),
    onOpenTaxon: onSelectTaxon,
  };

  // An out-of-scope or unknown taxon lands on the scope root rather than on a
  // broken surface (REQ-001, UX-002). Search (SPEC-013) indexes all 2,555 taxa,
  // including the 34 above Dinosauria, so this path is reachable.
  const requested = taxonId;
  const outOfScope = Boolean(requested && !index.inScope(requested));
  const focusId =
    requested && index.inScope(requested) ? requested : index.rootId;

  if (!focusId) {
    return (
      <section className={styles.profile} aria-label="Taxonomy">
        <div className={styles.topbar}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← Back to map
          </button>
        </div>
        <p className={styles.taxEmpty}>
          This snapshot holds no <span className="sciName">Dinosauria</span>, so
          there is no taxonomy to show.
        </p>
      </section>
    );
  }

  const focus = index.byId.get(focusId);
  const results = searchTaxa(query, searchIndex);

  return (
    <section className={styles.profile} aria-label="Taxonomy">
      <div className={styles.topbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to map
        </button>
        {onOpenProfile && focus && (
          <button
            type="button"
            className={styles.taxProfileLink}
            onClick={() => onOpenProfile(focus.id)}
          >
            Open taxon page →
          </button>
        )}
      </div>

      <header className={styles.taxHeader}>
        <h1 className="sciName">{focus?.scientificName ?? "Unavailable"}</h1>
        <p className={styles.taxHeaderMeta}>
          {focus?.rank} · {pluralGenera(index.descendantGenera(focusId))} at or
          below
          {index.isAvian(focusId) && (
            <>
              {" "}
              <AvianMark />
            </>
          )}
        </p>
        {outOfScope && (
          <p className={styles.taxNote} role="note">
            That taxon sits above <span className="sciName">Dinosauria</span>,
            where the atlas&rsquo;s taxonomy begins. Showing{" "}
            <span className="sciName">Dinosauria</span> instead.
          </p>
        )}
      </header>

      <LineageDescent taxonId={focusId} deps={deps} />
      <TaxonNeighbours taxonId={focusId} deps={deps} />
      <CladeSheet taxonId={focusId} deps={deps} />

      <section
        className={styles.taxSurface}
        aria-label="Find a taxon to compare"
      >
        <h2 className={styles.taxSurfaceTitle}>Find a taxon to compare</h2>
        <label className={styles.taxSearchField}>
          <span className={styles.statLabel}>Second taxon</span>
          <input
            type="search"
            className={styles.taxSearchInput}
            value={query}
            placeholder="Search a dinosaur…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {results.length > 0 && (
          <ul className={styles.taxSearchResults}>
            {results.map((r) => (
              <li key={r.taxonId}>
                <button
                  type="button"
                  className={styles.taxSearchResult}
                  onClick={() => {
                    setCompareId(r.taxonId);
                    setQuery("");
                  }}
                >
                  <span className="sciName">{r.scientificName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommonAncestor
        taxonId={focusId}
        otherId={compareId}
        deps={deps}
        onClear={() => setCompareId(null)}
      />

      {index.rootId && <CladeFan rootId={index.rootId} deps={deps} />}
    </section>
  );
}
