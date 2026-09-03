/**
 * The phone map screen's age strip (SPEC-030 REQ-005/REQ-006 as amended).
 *
 * The whole of the exploration header, on a phone, in two rows: step the age,
 * and read where you are. Everything else that used to sit here — the taxon
 * search, the to-scale timeline, the frame toggle, Reset view — is one tap away
 * behind the strip's own disclosure, because at 390×664 they cost 205px of a
 * 664px screen and the map is the subject of this screen, not its companion.
 *
 * What stays is chosen, not left over: FONC-040/050/060 make the age, the group
 * and the count permanent, and stepping the age is the loop's central verb, so
 * it stays a single tap rather than a tap through a drawer.
 */

import type { ReactElement } from "react";
import type { GeologicalStage } from "../../domain/index.js";
import { formatStageSpan } from "../format.js";
import { neighbourStage } from "../state/timeline.js";
import styles from "./exploration.module.css";

interface AgeStripProps {
  stages: readonly GeologicalStage[];
  selected: string;
  stage: GeologicalStage | undefined;
  onSelect: (stageName: string) => void;
  /** The selected group and the visible-occurrence count (FONC-050/060). */
  group: string;
  count: number;
  /** Whether the controls drawer is open, and its toggle. */
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export function AgeStrip({
  stages,
  selected,
  stage,
  onSelect,
  group,
  count,
  drawerOpen,
  onToggleDrawer,
}: AgeStripProps): ReactElement {
  const older = neighbourStage(stages, selected, "older");
  const younger = neighbourStage(stages, selected, "younger");

  return (
    <div className={styles.ageStrip}>
      <div className={styles.ageStripRow}>
        <button
          type="button"
          className={styles.stageStepper}
          aria-label="Older stage"
          title={
            older
              ? `Older stage · ${older.name}`
              : "Already at the oldest stage in the window"
          }
          disabled={!older}
          onClick={() => older && onSelect(older.name)}
        >
          ◀
        </button>

        {/* The readout doubles as the drawer's trigger: the age is what the
            drawer is mostly about, so the thing you would tap to change it more
            precisely is the thing that shows it. */}
        <button
          type="button"
          className={styles.ageReadout}
          aria-expanded={drawerOpen}
          onClick={onToggleDrawer}
        >
          <span className={styles.ageReadoutName}>{selected}</span>
          {stage && (
            <span className={`${styles.ageReadoutSpan} mono`}>
              {formatStageSpan(stage)}
            </span>
          )}
          <span className={styles.ageReadoutHint} aria-hidden="true">
            {drawerOpen ? "▴" : "▾"}
          </span>
        </button>

        <button
          type="button"
          className={styles.stageStepper}
          aria-label="Younger stage"
          title={
            younger
              ? `Younger stage · ${younger.name}`
              : "Already at the youngest stage in the window"
          }
          disabled={!younger}
          onClick={() => younger && onSelect(younger.name)}
        >
          ▶
        </button>
      </div>

      {/* FONC-050/060: the group and the count, permanently, in one line. */}
      <p className={styles.ageStripMeta}>
        <span>{group}</span>
        <span aria-hidden="true"> · </span>
        <span
          className={`${styles.countValue} mono`}
          aria-live="polite"
          data-occurrence-count
        >
          {count}
        </span>{" "}
        occurrences
      </p>
    </div>
  );
}
