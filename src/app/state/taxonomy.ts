/**
 * Taxonomy indexes (SPEC-017 DATA-001). The shipped snapshot stores only
 * `parentId`, so every question the taxonomy surfaces ask — what are this
 * taxon's children, how many genera does this branch hold, where do two lineages
 * meet — needs the tree indexed once per loaded model rather than re-scanned per
 * render (NFR-002; `ReadApi.getTaxon` is an O(n) `find`).
 *
 * **Scope: Dinosauria and below (REQ-001, owner decision 2026-08-05).** The
 * subtree holds 2,521 of the snapshot's 2,555 taxa, so the boundary costs almost
 * nothing; the 34-node stem from `Life` down to `Dinosauriformes` stays in the
 * data and is simply not a surface this spec builds.
 *
 * Pure and framework-free, so the whole thing is unit-testable without React.
 * Every traversal is cycle-safe: malformed data ends a walk rather than hanging
 * a render (Error handling).
 */

import type { ReadTaxon } from "../../domain/index.js";

/** The atlas's scope root. Matches the breadcrumb's anchor (SPEC-014). */
export const SCOPE_ROOT_NAME = "Dinosauria";

/**
 * Avian branches inside Dinosauria (REQ-006). Birds *are* dinosaurs, so these
 * sit legitimately within the scope root; the product, however, covers non-avian
 * dinosaurs (CONS-020/030). They are shown and marked rather than hidden —
 * excising them would misrepresent Theropoda's shape, and showing them unmarked
 * would imply coverage the atlas does not claim (FONC-400, CONS-100).
 */
export const AVIAN_ROOT_NAMES: readonly string[] = [
  "Aves",
  "Avialae",
  "Enantiornithes",
];

/** Guard against a malformed chain looping forever (Error handling). */
const MAX_DEPTH = 64;

export interface TaxonomyIndex {
  /** Every taxon in the loaded model, by id — including out-of-scope ones. */
  readonly byId: ReadonlyMap<string, ReadTaxon>;
  /** The scope root's id, or null if the snapshot has no `Dinosauria`. */
  readonly rootId: string | null;
  /** Ids inside the `Dinosauria` subtree (REQ-001). */
  readonly scope: ReadonlySet<string>;
  /** Ids inside an avian branch (REQ-006). Always a subset of `scope`. */
  readonly avian: ReadonlySet<string>;
  /** Construction cost, for NFR-002's bounded-work assertion. */
  readonly stats: { readonly taxa: number; readonly visits: number };

  /** Direct children of a taxon, in scope, ordered by scientific name. */
  children(id: string): readonly ReadTaxon[];
  /**
   * The chain from the scope root down to `id`, inclusive — never above the root
   * (REQ-001). Empty when `id` is out of scope or unknown. A dangling `parentId`
   * ends the walk, so the chain is returned as far as it resolves.
   */
  ancestors(id: string): readonly ReadTaxon[];
  /** Genera at or below a taxon. A genus counts itself. */
  descendantGenera(id: string): number;
  /** Every genus at or below a taxon, ordered by scientific name (REQ-002). */
  genera(id: string): readonly ReadTaxon[];
  inScope(id: string): boolean;
  isAvian(id: string): boolean;
}

/**
 * Build every index in one pass over the taxa plus one traversal of the tree.
 * Nothing here is lazy, so a surface never pays a build cost mid-render.
 */
export function buildTaxonomyIndex(taxa: readonly ReadTaxon[]): TaxonomyIndex {
  let visits = 0;

  const byId = new Map<string, ReadTaxon>();
  for (const t of taxa) {
    visits++;
    byId.set(t.id, t);
  }

  // Invert parentId → children. Self-parenting is dropped rather than trusted.
  const childIds = new Map<string, string[]>();
  for (const t of taxa) {
    visits++;
    const parent = t.parentId;
    if (!parent || parent === t.id || !byId.has(parent)) continue;
    const siblings = childIds.get(parent);
    if (siblings) siblings.push(t.id);
    else childIds.set(parent, [t.id]);
  }

  const byName = new Map<string, string>();
  for (const t of taxa) {
    if (!byName.has(t.scientificName)) byName.set(t.scientificName, t.id);
  }
  const rootId = byName.get(SCOPE_ROOT_NAME) ?? null;

  /** Ids at or below `startId`, cycle-safe. */
  const subtree = (startId: string): Set<string> => {
    const out = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (out.has(id)) continue; // cycle or diamond — visit once
      visits++;
      out.add(id);
      for (const child of childIds.get(id) ?? []) stack.push(child);
    }
    return out;
  };

  const scope = rootId ? subtree(rootId) : new Set<string>();

  const avian = new Set<string>();
  for (const name of AVIAN_ROOT_NAMES) {
    const id = byName.get(name);
    if (!id || !scope.has(id)) continue;
    for (const member of subtree(id)) if (scope.has(member)) avian.add(member);
  }

  const byNameAsc = (a: ReadTaxon, b: ReadTaxon): number =>
    a.scientificName.localeCompare(b.scientificName);

  const children = (id: string): readonly ReadTaxon[] => {
    const ids = childIds.get(id) ?? [];
    const out: ReadTaxon[] = [];
    for (const childId of ids) {
      if (!scope.has(childId)) continue;
      const taxon = byId.get(childId);
      if (taxon) out.push(taxon);
    }
    return out.sort(byNameAsc);
  };

  // Genera per subtree, memoised so a fan or a sheet never recomputes a branch.
  const generaCache = new Map<string, ReadTaxon[]>();
  const genera = (id: string): readonly ReadTaxon[] => {
    const cached = generaCache.get(id);
    if (cached) return cached;
    const out: ReadTaxon[] = [];
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current) || !scope.has(current)) continue;
      seen.add(current);
      const taxon = byId.get(current);
      if (taxon?.rank === "Genus") out.push(taxon);
      for (const child of childIds.get(current) ?? []) stack.push(child);
    }
    out.sort(byNameAsc);
    generaCache.set(id, out);
    return out;
  };

  const ancestors = (id: string): readonly ReadTaxon[] => {
    if (!scope.has(id)) return [];
    const chain: ReadTaxon[] = [];
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current && !seen.has(current.id) && chain.length < MAX_DEPTH) {
      chain.push(current);
      seen.add(current.id);
      // Stop at the scope root — never walk above Dinosauria (REQ-001).
      if (current.id === rootId) break;
      const parentId = current.parentId;
      current =
        parentId && scope.has(parentId) ? byId.get(parentId) : undefined;
    }
    return chain.reverse();
  };

  return {
    byId,
    rootId,
    scope,
    avian,
    stats: { taxa: taxa.length, visits },
    children,
    ancestors,
    genera,
    descendantGenera: (id) => genera(id).length,
    inScope: (id) => scope.has(id),
    isAvian: (id) => avian.has(id),
  };
}

/** How two taxa are related, expressed only in branchings (REQ-003). */
export interface Relatedness {
  kind: "convergence" | "containment" | "same" | "unrelated";
  /** The last common ancestor, or null when the two share none in scope. */
  ancestor: ReadTaxon | null;
  /** Branchings from the first taxon up to the ancestor. */
  stepsA: number;
  /** Branchings from the second taxon up to the ancestor. */
  stepsB: number;
}

/**
 * Last common ancestor of two taxa, as a set intersection of their ancestor
 * chains (REQ-003).
 *
 * **Branchings only — never time.** PBDB's parent chain is a taxonomic
 * *containment* hierarchy, not a dated phylogeny: the number of steps measures
 * how finely taxonomists have subdivided that region of the tree, not elapsed
 * evolutionary time. Nothing derived here may be rendered as a duration, a date
 * or a rate (CONS-290).
 */
export function relatedness(
  index: TaxonomyIndex,
  idA: string,
  idB: string,
): Relatedness {
  const empty: Relatedness = {
    kind: "unrelated",
    ancestor: null,
    stepsA: 0,
    stepsB: 0,
  };
  if (!index.inScope(idA) || !index.inScope(idB)) return empty;
  if (idA === idB) {
    return {
      kind: "same",
      ancestor: index.byId.get(idA) ?? null,
      stepsA: 0,
      stepsB: 0,
    };
  }

  const chainA = index.ancestors(idA);
  const chainB = index.ancestors(idB);
  if (chainA.length === 0 || chainB.length === 0) return empty;

  // Both chains start at the scope root, so the shared prefix is the meeting
  // point: the deepest node present in both.
  let shared = 0;
  while (
    shared < chainA.length &&
    shared < chainB.length &&
    chainA[shared]!.id === chainB[shared]!.id
  ) {
    shared++;
  }
  if (shared === 0) return empty;

  const ancestor = chainA[shared - 1]!;
  const stepsA = chainA.length - shared;
  const stepsB = chainB.length - shared;
  // One taxon *is* the ancestor of the other: that is containment, not two
  // lineages converging, and must be stated as such (Edge cases).
  const kind =
    ancestor.id === idA || ancestor.id === idB ? "containment" : "convergence";
  return { kind, ancestor, stepsA, stepsB };
}
