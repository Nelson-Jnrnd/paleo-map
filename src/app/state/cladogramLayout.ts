/**
 * Cladogram layout (SPEC-025 REQ-001). Turns a `RevealedTree` into an ordered
 * list of rows, one row per label, with integer row and depth coordinates.
 *
 * **Why a pure function of integers.** The old render was an indented list whose
 * connectors were CSS pseudo-elements sized in `rem` while the rows were sized by
 * their content. Two coordinate systems described the same picture, so any label
 * that wrapped put them out of step — the "wonky text" the owner reported. Here
 * the labels and the connectors are both derived from the same `(row, depth)`
 * integers, so they cannot disagree; and because every label owns a whole row,
 * label collision is structurally impossible rather than tuned.
 *
 * No DOM, no measurement, no React — the geometry is decided before anything is
 * drawn, which is also what makes it testable without a browser.
 */

import type { RevealedTree } from "./dailyGenus.js";

export type CladogramRowKind = "node" | "cut" | "guess";

export interface CladogramRow {
  readonly kind: CladogramRowKind;
  /** Zero-based index in the emitted list — the row's y coordinate. */
  readonly row: number;
  /** The x coordinate, in indent steps from the trunk's origin. */
  readonly depth: number;
  readonly id: string;
  readonly name: string;
  /** Trunk rows only: the taxon's rank, and its frontier/reachedBy marks. */
  readonly rank?: string;
  readonly frontier?: boolean;
  readonly reachedBy?: string | null;
  /** Cut and guess rows: the guess that ruled the branch out. */
  readonly by?: string;
  /**
   * True when this `cut` row is also the guess — `cut.name === cut.by`, i.e. the
   * player guessed the very branch their guess eliminated. One taxon, one row.
   */
  readonly isOwnGuess?: boolean;
  /** Cut rows: the trunk row this branch hangs off, for the connector layer. */
  readonly parentRow?: number;
  /** Guess rows: the cut row this guess hangs off. */
  readonly cutRow?: number;
}

export interface CladogramLayout {
  readonly rows: readonly CladogramRow[];
  /** The column every ruled-out branch is drawn at. */
  readonly tipDepth: number;
  /** The column every guess is drawn at, one indent further right. */
  readonly guessDepth: number;
}

/**
 * Walk the trunk root-first, emitting each node and then the branches ruled out
 * at it — each branch followed by the guess inside it.
 *
 * The `cut.name === cut.by` case collapses to a single row with no special rule
 * in the drawing: when the guessed genus *is* the branch that was eliminated,
 * there is one taxon, so there is one node. `evaluateGuess` sets the ruled-out
 * branch to `ancestors(guess)[sharedAt + 1]`, which is the guess itself whenever
 * the guess is a direct child of the shared clade.
 */
export function layoutCladogram(tree: RevealedTree): CladogramLayout {
  const rows: CladogramRow[] = [];
  const maxTrunkDepth = Math.max(0, tree.trunk.length - 1);
  const tipDepth = maxTrunkDepth + 1;
  const guessDepth = tipDepth + 1;

  tree.trunk.forEach((node, depth) => {
    const parentRow = rows.length;
    rows.push({
      kind: "node",
      row: parentRow,
      depth,
      id: node.id,
      name: node.name,
      rank: node.rank,
      frontier: node.frontier,
      reachedBy: node.reachedBy,
    });

    for (const cut of node.ruledOut) {
      const isOwnGuess = cut.name === cut.by;
      const cutRow = rows.length;
      rows.push({
        kind: "cut",
        row: cutRow,
        depth: tipDepth,
        id: cut.id,
        name: cut.name,
        by: cut.by,
        isOwnGuess,
        parentRow,
      });
      // The guess is a leaf inside the branch it ruled out — taxonomically true,
      // since the branch is an ancestor-or-self of the guess. When they are the
      // same taxon the row above already is the guess, so no second row.
      if (!isOwnGuess) {
        rows.push({
          kind: "guess",
          row: rows.length,
          depth: guessDepth,
          id: `${cut.id}:${cut.by}`,
          name: cut.by,
          by: cut.by,
          cutRow,
        });
      }
    }
  });

  // `tree.unresolved` is deliberately not emitted (REQ-004): the continuation
  // mark is retired, so the diagram ends at its last row.
  return { rows, tipDepth, guessDepth };
}
