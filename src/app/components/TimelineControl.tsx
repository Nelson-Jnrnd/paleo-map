/**
 * Stage-stepped timeline (SPEC-003 REQ-004). Steps the selected age by geological
 * stage across the Mesozoic window and shows each stage's Ma span; the selected
 * stage is the precise selected age, visually distinct (teal, aria-pressed) from
 * an occurrence's time range (FONC-090/100/110/120/170; OQ-030). Keyboard-usable
 * (PERF-230). Period colour dots are meaning-only (charter §4), never the sole
 * signal — each button also carries its name and span as text (PERF-250).
 */

import type { ReactElement } from "react";
import type { GeologicalStage } from "../../domain/index.js";
import { formatStageSpan } from "../format.js";
import styles from "./exploration.module.css";

interface TimelineControlProps {
  stages: readonly GeologicalStage[];
  selected: string;
  onSelect: (stageName: string) => void;
}

export function TimelineControl({
  stages,
  selected,
  onSelect,
}: TimelineControlProps): ReactElement {
  return (
    <nav className={styles.timeline} aria-label="Geological stage timeline">
      <div className={styles.timelineLabel}>
        <span className={styles.statLabel}>Timeline</span>
        <span className={styles.brandSub}>stepped by stage</span>
      </div>
      <ul className={styles.stageList}>
        {stages.map((stage) => {
          const isSelected = stage.name === selected;
          return (
            <li key={stage.name}>
              <button
                type="button"
                className={styles.stageButton}
                aria-pressed={isSelected}
                onClick={() => onSelect(stage.name)}
              >
                <span className={styles.stageName}>
                  <span
                    className={styles.stageDot}
                    style={{ background: stage.periodColour }}
                    aria-hidden="true"
                  />{" "}
                  {stage.name}
                </span>
                <span className={`${styles.stageSpan} mono`}>
                  {formatStageSpan(stage)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
