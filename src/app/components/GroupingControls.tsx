/**
 * The list's unit selector (SPEC-026 REQ-001). One always-visible control over
 * five flat options — Occurrence · Locality · Genus · Family · Major group.
 *
 * It replaces the mode segmented control plus the rank `<select>` that appeared
 * only in Taxon mode: two controls answering one question, where the third mode
 * secretly spawned a dropdown. The option set is identical in every state of the
 * column, so nothing appears, disappears or changes size as a result of choosing.
 *
 * Active state is carried by weight, a rule *and* `aria-checked` — never colour
 * alone (PERF-250).
 */

import type { ReactElement } from "react";
import { LIST_UNITS, LIST_UNIT_LABEL } from "../state/grouping.js";
import type { ListUnit } from "../state/grouping.js";
import styles from "./exploration.module.css";

interface GroupingControlsProps {
  unit: ListUnit;
  onSelectUnit: (unit: ListUnit) => void;
  /** Loading and error keep the options visible but inert (charter §7). */
  disabled?: boolean;
}

export function GroupingControls({
  unit,
  onSelectUnit,
  disabled = false,
}: GroupingControlsProps): ReactElement {
  return (
    <div className={styles.unitBar}>
      {/* The question the options answer is obvious from the options themselves,
          so it is not printed above them; the group still carries it as its
          accessible name, which is what a screen reader announces. */}
      <div
        className={styles.unitGroup}
        role="radiogroup"
        aria-label="One row per"
      >
        {LIST_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={unit === u}
            disabled={disabled}
            className={`${styles.unitOption} ${unit === u ? styles.unitOptionOn : ""}`}
            onClick={() => onSelectUnit(u)}
          >
            {LIST_UNIT_LABEL[u]}
          </button>
        ))}
      </div>
    </div>
  );
}
