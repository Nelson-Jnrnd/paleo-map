/** SPEC-031: one taxonomy view at a time, reached from a selected dinosaur. */
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import { buildTaxonomyIndex } from "../state/taxonomy.js";
import { CladeFan, TaxonNeighbours } from "./TaxonomySurfaces.js";
import type { TaxonomyDeps } from "./TaxonomySurfaces.js";
import styles from "./exploration.module.css";

interface TaxonomyScreenProps {
  api: ReadApi;
  taxonId: string | null;
  onSelectTaxon: (taxonId: string) => void;
  onOpenProfile?: (taxonId: string) => void;
}
export function TaxonomyScreen({
  api,
  taxonId,
  onSelectTaxon,
  onOpenProfile,
}: TaxonomyScreenProps): ReactElement {
  const index = useMemo(() => buildTaxonomyIndex(api.listTaxa()), [api]);
  const [view, setView] = useState<"relationships" | "genera" | "tree">(
    "relationships",
  );
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  const focusId = taxonId && index.inScope(taxonId) ? taxonId : index.rootId;
  if (!focusId)
    return (
      <section className={styles.profile} aria-label="Taxonomy">
        <p>No taxonomy is available.</p>
      </section>
    );
  const focus = index.byId.get(focusId);
  const deps: TaxonomyDeps = {
    index,
    profileOf: (id) => api.getProfile(id),
    onOpenTaxon: (id) => {
      onSelectTaxon(id);
      setQuery("");
      setLimit(60);
      setView("relationships");
    },
  };
  const genera = index
    .genera(focusId)
    .filter(
      (t) =>
        !index.isAvian(t.id) &&
        t.scientificName.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <section className={styles.profile} aria-label="Taxonomy">
      <header className={styles.taxHeader}>
        <h1 className="sciName">{focus?.scientificName}</h1>
        {taxonId && !index.inScope(taxonId) && (
          <p role="note">
            Showing Dinosauria; this taxon is outside the atlas taxonomy.
          </p>
        )}
        {onOpenProfile && focus?.wikipedia && (
          <button
            type="button"
            className={styles.reset}
            onClick={() => onOpenProfile(focusId)}
          >
            Read about this dinosaur
          </button>
        )}
      </header>
      <div className={styles.unitGroup} role="group" aria-label="Taxonomy view">
        {(
          [
            ["relationships", "Related groups"],
            ["genera", "Browse genera"],
            ["tree", "Tree view"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={styles.unitOption}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "relationships" && (
        <TaxonNeighbours taxonId={focusId} deps={deps} compact />
      )}
      {view === "genera" && (
        <section
          aria-label="Genera in this clade"
          className={styles.taxSurface}
        >
          <label className={styles.taxSearchField}>
            Find a genus
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              className={styles.taxSearchInput}
            />
          </label>
          <p>
            {genera.length} {genera.length === 1 ? "genus" : "genera"}
          </p>
          <ul className={styles.neighbourList}>
            {genera.slice(0, limit).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={styles.neighbourItem}
                  onClick={() => deps.onOpenTaxon(t.id)}
                >
                  <span className="sciName">{t.scientificName}</span>
                </button>
              </li>
            ))}
          </ul>
          {genera.length > limit && (
            <button
              type="button"
              className={styles.reset}
              onClick={() => setLimit((n) => n + 60)}
            >
              Load more genera
            </button>
          )}
        </section>
      )}
      {view === "tree" && index.rootId && (
        <CladeFan rootId={index.rootId} deps={deps} />
      )}
    </section>
  );
}
