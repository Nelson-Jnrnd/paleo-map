/**
 * Grouping-mode control + rank selector (SPEC-010 REQ-001/005). An always-visible
 * segmented control switches the grouping unit (Occurrences / Localities / Taxa);
 * in Taxon mode a rank selector chooses the roll-up tier (Genus / Family / Major
 * group). Domain language, legible as text, keyboard-operable; the active mode is
 * carried by `aria-pressed` (not colour alone — charter §4, PERF-250).
 */

import type { ReactElement } from "react";
import {
  RANK_TIERS,
  RANK_TIER_LABEL,
} from "../state/grouping.js";
import type { GroupingMode, RankTier } from "../state/grouping.js";
import styles from "./exploration.module.css";

const MODES: ReadonlyArray<{ mode: GroupingMode; label: string }> = [
  { mode: "occurrence", label: "Occurrences" },
  { mode: "locality", label: "Localities" },
  { mode: "taxon", label: "Taxa" },
];

interface GroupingControlsProps {
  mode: GroupingMode;
  rank: RankTier;
  onSelectMode: (mode: GroupingMode) => void;
  onSelectRank: (rank: RankTier) => void;
}

export function GroupingControls({
  mode,
  rank,
  onSelectMode,
  onSelectRank,
}: GroupingControlsProps): ReactElement {
  return (
    <div className={styles.listHeaderTop}>
      <div
        className={styles.groupByToggle}
        role="group"
        aria-label="Group occurrences by"
      >
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => onSelectMode(m.mode)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "taxon" && (
        <label className={styles.statLabel}>
          Group by rank{" "}
          <select
            aria-label="Group by rank"
            value={rank}
            onChange={(e) => onSelectRank(e.target.value as RankTier)}
          >
            {RANK_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {RANK_TIER_LABEL[tier]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
