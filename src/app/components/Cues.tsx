/**
 * Small, reusable provenance/uncertainty cues (SPEC-003 REQ-006/007; charter §2).
 * Each cue carries a visible text label — never colour alone (PERF-250) — so a
 * multi-stage time range and missing fields are legible at a glance, not hidden
 * behind a hover (CONS-490). SPEC-007 retired the reconstructed/interpretative
 * cues and relabelled the time cue to the factual "spans multiple stages".
 */

import type { ReactElement, ReactNode } from "react";
import styles from "./Cues.module.css";
import { NOT_AVAILABLE } from "../format.js";

export function MultiStageCue(): ReactElement {
  return (
    <span
      className={styles.chip}
      title="Time range spans more than one geological stage"
    >
      <span className={styles.glyph} aria-hidden="true">
        ≈
      </span>
      Spans multiple stages
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
