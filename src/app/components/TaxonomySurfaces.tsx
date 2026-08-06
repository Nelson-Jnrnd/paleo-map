/**
 * The five taxonomy surfaces (SPEC-017 REQ-002…REQ-007). Each is a thin renderer
 * over the indexes in `state/taxonomy.ts` and the geometry in `cladeFan.ts` —
 * all derivation is pure and tested separately, so these components only lay
 * things out.
 *
 * Charter (UX-001): scientific names in italics, domain language only, cool
 * neutrals with teal as the single accent, and silhouettes used as information
 * rather than decoration. The 2026-08-05 restraint override is scoped to the
 * basemap (SPEC-018) and does **not** apply here.
 */

import type { ReactElement } from "react";
import type { ReadProfile, ReadTaxon } from "../../domain/index.js";
import type { TaxonomyIndex } from "../state/taxonomy.js";
import { relatedness } from "../state/taxonomy.js";
import { FAN_MAX_DEPTH, buildFan, labelPoint, wedgePath } from "./cladeFan.js";
import styles from "./exploration.module.css";

/** "1 genus" / "N genera" — the atlas uses domain language, correctly inflected. */
export function pluralGenera(n: number): string {
  return n === 1 ? "1 genus" : `${n} genera`;
}

/** Silhouette entries rendered at once, per surface (NFR-002). */
export const SILHOUETTE_RENDER_CAP = 120;

export interface TaxonomyDeps {
  index: TaxonomyIndex;
  /** Resolves a taxon's profile, for its silhouette. */
  profileOf: (taxonId: string) => ReadProfile | undefined;
  onOpenTaxon: (taxonId: string) => void;
}

/* -------------------------------------------------------------------------- */
/* REQ-006 — avian coverage marker                                             */
/* -------------------------------------------------------------------------- */

/**
 * Birds are dinosaurs, so avian taxa sit legitimately inside the scope root.
 * The atlas covers non-avian dinosaurs, so they are marked rather than hidden —
 * and the wording says *coverage*, never exclusion from Dinosauria.
 */
export function AvianMark(): ReactElement {
  return (
    <span
      className={styles.avianMark}
      title="Avian dinosaur — inside Dinosauria, outside this atlas's non-avian coverage"
    >
      avian — outside this atlas&rsquo;s coverage
    </span>
  );
}

function Silhouette({
  taxon,
  deps,
}: {
  taxon: ReadTaxon;
  deps: TaxonomyDeps;
}): ReactElement {
  const src = deps.profileOf(taxon.id)?.silhouette ?? null;
  if (!src) {
    // Never substitute a relative's silhouette — that would be an unmarked
    // assumption (FONC-1120, CONS-440).
    return (
      <span
        className={styles.silhouetteMissing}
        role="img"
        aria-label={`No silhouette for ${taxon.scientificName}`}
      >
        —
      </span>
    );
  }
  return (
    <img
      className={styles.silhouette}
      src={src}
      alt={`Silhouette of ${taxon.scientificName}`}
      loading="lazy"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* REQ-002 — clade silhouette sheet                                            */
/* -------------------------------------------------------------------------- */

export function CladeSheet({
  taxonId,
  deps,
}: {
  taxonId: string;
  deps: TaxonomyDeps;
}): ReactElement {
  const { index } = deps;
  // Genera *below* this taxon. `index.genera` counts a genus as its own member —
  // right for the fan and the neighbour counts, wrong here, where a sheet
  // showing only the taxon you are already looking at says nothing.
  const all = index.genera(taxonId).filter((g) => g.id !== taxonId);
  const shown = all.slice(0, SILHOUETTE_RENDER_CAP);
  const taxon = index.byId.get(taxonId);

  if (all.length === 0) {
    return (
      <section className={styles.taxSurface} aria-label="Genera in this clade">
        <h2 className={styles.taxSurfaceTitle}>Genera in this clade</h2>
        <p className={styles.taxEmpty}>
          <span className="sciName">
            {taxon?.scientificName ?? "This taxon"}
          </span>{" "}
          contains no genera below it — it is itself the finest level the atlas
          holds here.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.taxSurface} aria-label="Genera in this clade">
      <h2 className={styles.taxSurfaceTitle}>Genera in this clade</h2>
      <p className={styles.taxCount}>
        {all.length === 1 ? "1 genus" : `${all.length} genera`}
        {shown.length < all.length
          ? ` · showing the first ${shown.length} of ${all.length}`
          : ""}
      </p>
      <ul className={styles.cladeSheet}>
        {shown.map((genus) => (
          <li key={genus.id}>
            <button
              type="button"
              className={styles.cladeSheetItem}
              onClick={() => deps.onOpenTaxon(genus.id)}
            >
              <Silhouette taxon={genus} deps={deps} />
              <span className="sciName">{genus.scientificName}</span>
              {index.isAvian(genus.id) && <AvianMark />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* REQ-004 — lineage descent                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The milestone nodes of a dinosaur descent, approved by the owner 2026-08-05.
 * Declared once here so REQ-004's emphasis is a reviewable constant rather than
 * a condition scattered across the render.
 */
export const DESCENT_MILESTONES: ReadonlySet<string> = new Set([
  "Dinosauria",
  "Saurischia",
  "Ornithischia",
  "Theropoda",
  "Sauropodomorpha",
  "Sauropoda",
  "Ornithopoda",
  "Thyreophora",
  "Ceratopsia",
  "Marginocephalia",
]);

export function LineageDescent({
  taxonId,
  deps,
}: {
  taxonId: string;
  deps: TaxonomyDeps;
}): ReactElement {
  const { index } = deps;
  const chain = index.ancestors(taxonId);

  if (chain.length === 0) {
    return (
      <section className={styles.taxSurface} aria-label="Descent">
        <h2 className={styles.taxSurfaceTitle}>Descent</h2>
        <p className={styles.taxEmpty}>
          This taxon sits outside Dinosauria, which is where the atlas&rsquo;s
          taxonomy begins.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.taxSurface} aria-label="Descent">
      <h2 className={styles.taxSurfaceTitle}>Descent</h2>
      <p className={styles.taxCount}>
        {chain.length === 1
          ? "The root of the atlas's taxonomy"
          : `${chain.length} branchings from Dinosauria`}
      </p>
      <ol className={styles.descent}>
        {chain.map((node) => {
          const milestone =
            DESCENT_MILESTONES.has(node.scientificName) || node.id === taxonId;
          const current = node.id === taxonId;
          return (
            <li
              key={node.id}
              className={
                milestone ? styles.descentMilestone : styles.descentStep
              }
            >
              {milestone && <Silhouette taxon={node} deps={deps} />}
              {current ? (
                <span className={`sciName ${styles.descentCurrent}`}>
                  {node.scientificName}
                </span>
              ) : (
                <button
                  type="button"
                  className={`sciName ${styles.descentLink}`}
                  onClick={() => deps.onOpenTaxon(node.id)}
                >
                  {node.scientificName}
                </button>
              )}
              <span className={styles.descentRank}>{node.rank}</span>
              {index.isAvian(node.id) && <AvianMark />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* REQ-007 — neighbours                                                        */
/* -------------------------------------------------------------------------- */

function NeighbourList({
  label,
  taxa,
  deps,
  emptyNote,
}: {
  label: string;
  taxa: readonly ReadTaxon[];
  deps: TaxonomyDeps;
  emptyNote: string;
}): ReactElement {
  return (
    <div className={styles.neighbourGroup}>
      <h3 className={styles.neighbourLabel}>{label}</h3>
      {taxa.length === 0 ? (
        <p className={styles.taxEmpty}>{emptyNote}</p>
      ) : (
        <ul className={styles.neighbourList}>
          {taxa.slice(0, SILHOUETTE_RENDER_CAP).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={styles.neighbourItem}
                onClick={() => deps.onOpenTaxon(t.id)}
              >
                <Silhouette taxon={t} deps={deps} />
                <span className="sciName">{t.scientificName}</span>
                <span className={styles.neighbourCount}>
                  {pluralGenera(deps.index.descendantGenera(t.id))}
                </span>
                {deps.index.isAvian(t.id) && <AvianMark />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaxonNeighbours({
  taxonId,
  deps,
}: {
  taxonId: string;
  deps: TaxonomyDeps;
}): ReactElement {
  const { index } = deps;
  const taxon = index.byId.get(taxonId);
  const parentId = taxon?.parentId;
  const parent =
    parentId && index.inScope(parentId) ? index.byId.get(parentId) : undefined;
  const siblings = parent
    ? index.children(parent.id).filter((t) => t.id !== taxonId)
    : [];
  const children = index.children(taxonId);

  return (
    <section className={styles.taxSurface} aria-label="Neighbours on the tree">
      <h2 className={styles.taxSurfaceTitle}>Neighbours on the tree</h2>
      <NeighbourList
        label="Parent"
        taxa={parent ? [parent] : []}
        deps={deps}
        emptyNote="Dinosauria is the root of the atlas's taxonomy — there is nothing above it here."
      />
      <NeighbourList
        label="Siblings"
        taxa={siblings}
        deps={deps}
        emptyNote="No siblings — this taxon is its parent's only child in the atlas."
      />
      <NeighbourList
        label="Children"
        taxa={children}
        deps={deps}
        emptyNote="No children — this is a tip of the tree as the atlas holds it."
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* REQ-003 — common ancestor                                                   */
/* -------------------------------------------------------------------------- */

export function CommonAncestor({
  taxonId,
  otherId,
  deps,
  onClear,
}: {
  taxonId: string;
  otherId: string | null;
  deps: TaxonomyDeps;
  onClear: () => void;
}): ReactElement {
  const { index } = deps;
  const a = index.byId.get(taxonId);

  if (!otherId) {
    return (
      <section className={styles.taxSurface} aria-label="Compare two taxa">
        <h2 className={styles.taxSurfaceTitle}>Compare two taxa</h2>
        <p className={styles.taxEmpty}>
          Search for a second taxon to see where the two lineages meet.
        </p>
      </section>
    );
  }

  const b = index.byId.get(otherId);
  const rel = relatedness(index, taxonId, otherId);

  return (
    <section className={styles.taxSurface} aria-label="Compare two taxa">
      <h2 className={styles.taxSurfaceTitle}>Compare two taxa</h2>
      <p className={styles.taxCompareHeads}>
        <span className="sciName">{a?.scientificName ?? "Unavailable"}</span>
        {" and "}
        <span className="sciName">{b?.scientificName ?? "Unavailable"}</span>
        <button type="button" className={styles.taxClear} onClick={onClear}>
          Clear
        </button>
      </p>

      {rel.kind === "unrelated" || !rel.ancestor ? (
        <p className={styles.taxEmpty}>
          These two share no ancestor inside Dinosauria, so the atlas cannot
          place them on one tree.
        </p>
      ) : rel.kind === "same" ? (
        <p className={styles.taxCompareResult}>
          The same taxon — nought branchings apart.
        </p>
      ) : rel.kind === "containment" ? (
        <p className={styles.taxCompareResult}>
          <span className="sciName">{rel.ancestor.scientificName}</span>{" "}
          contains the other: {Math.max(rel.stepsA, rel.stepsB)} branchings
          between them.
        </p>
      ) : (
        <>
          <p className={styles.taxCompareResult}>
            Their lineages meet at{" "}
            <span className="sciName">{rel.ancestor.scientificName}</span>.
          </p>
          <ul className={styles.taxCompareArms}>
            <li>
              <span className="sciName">{a?.scientificName}</span> —{" "}
              {rel.stepsA} branchings from there
            </li>
            <li>
              <span className="sciName">{b?.scientificName}</span> —{" "}
              {rel.stepsB} branchings from there
            </li>
          </ul>
        </>
      )}

      <p className={styles.taxNote} role="note">
        Branchings count steps in the atlas&rsquo;s classification, which
        records how finely this part of the tree has been named — not how long
        ago the two lineages parted.
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* REQ-005 — clade fan                                                         */
/* -------------------------------------------------------------------------- */

const FAN_RADIUS = 150;

export function CladeFan({
  rootId,
  deps,
}: {
  rootId: string;
  deps: TaxonomyDeps;
}): ReactElement {
  const { index } = deps;
  const wedges = buildFan(index, rootId);
  const root = index.byId.get(rootId);
  const size = FAN_RADIUS * 2 + 8;

  if (wedges.length === 0) {
    return (
      <section
        className={styles.taxSurface}
        aria-label="The shape of Dinosauria"
      >
        <h2 className={styles.taxSurfaceTitle}>The shape of Dinosauria</h2>
        <p className={styles.taxEmpty}>
          No branches below{" "}
          <span className="sciName">
            {root?.scientificName ?? "this taxon"}
          </span>{" "}
          hold genera, so there is no fan to draw.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.taxSurface} aria-label="The shape of Dinosauria">
      <h2 className={styles.taxSurfaceTitle}>The shape of Dinosauria</h2>
      <p className={styles.taxCount}>
        Wedge width is the number of genera the branch holds.
      </p>

      <svg
        className={styles.fan}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        role="img"
        aria-label={`Radial tree of ${root?.scientificName ?? "Dinosauria"}, ${wedges.length} branches`}
      >
        {wedges.map((w) => (
          <path
            key={w.taxonId}
            className={styles.fanWedge}
            d={wedgePath(w, FAN_RADIUS, FAN_MAX_DEPTH)}
            onClick={() => deps.onOpenTaxon(w.taxonId)}
          />
        ))}
        {wedges
          .filter((w) => w.labelled)
          .map((w) => {
            const { x, y } = labelPoint(w, FAN_RADIUS, FAN_MAX_DEPTH);
            return (
              <text
                key={`label-${w.taxonId}`}
                className={styles.fanLabel}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {w.name}
              </text>
            );
          })}
      </svg>

      {/*
        REQ-005 / NFR-003: the geometric encoding needs a textual equivalent, and
        it doubles as the way an unlabelled wedge stays identifiable.
      */}
      <details className={styles.fanList}>
        <summary>All {wedges.length} branches, as a list</summary>
        <ul>
          {wedges.map((w) => (
            <li
              key={`row-${w.taxonId}`}
              style={{ marginLeft: `${(w.depth - 1) * 12}px` }}
            >
              <button
                type="button"
                className={styles.fanListItem}
                onClick={() => deps.onOpenTaxon(w.taxonId)}
              >
                <span className="sciName">{w.name}</span>
                <span className={styles.neighbourCount}>
                  {pluralGenera(w.genera)}
                </span>
                {w.avian && <AvianMark />}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
