/**
 * Small, reusable provenance/uncertainty cues (SPEC-003 REQ-003/006/007; charter
 * §2). Each cue carries a visible text label — never colour alone (PERF-250) —
 * so reconstructed positions, approximate ranges, interpretative data and
 * missing fields are legible at a glance, not hidden behind a hover (CONS-490).
 */

import type { ReactElement, ReactNode } from "react";
import styles from "./Cues.module.css";
import { NOT_AVAILABLE } from "../format.js";

export function ReconstructedCue(): ReactElement {
  return (
    <span
      className={styles.chip}
      title="Paleogeographic position is modeled, not observed"
    >
      <span className={styles.glyph} aria-hidden="true">
        ▲
      </span>
      Reconstructed
    </span>
  );
}

export function ApproximateCue(): ReactElement {
  return (
    <span
      className={styles.chip}
      title="Time range is uncertain / spans more than one stage"
    >
      <span className={styles.glyph} aria-hidden="true">
        ≈
      </span>
      Approximate
    </span>
  );
}

export function InterpretativeCue(): ReactElement {
  return (
    <span
      className={`${styles.chip} ${styles.interpretative}`}
      title="Inferred (encyclopedic/editorial), not fossil-derived"
    >
      Interpretative
    </span>
  );
}

/** Explicit "Not available" label for a missing sourced value (FONC-490/1120). */
export function MissingValue(): ReactElement {
  return <span className={styles.missing}>{NOT_AVAILABLE}</span>;
}

export function AttentionNote({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <span className={`${styles.chip} ${styles.attention}`} role="note">
      {children}
    </span>
  );
}
