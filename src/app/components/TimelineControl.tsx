/**
 * Stage-stepped timeline (SPEC-003 REQ-004; SPEC-008 REQ-002/003). Steps the
 * selected age by geological stage across the **full Mesozoic** window and shows
 * each stage's Ma span; the selected stage is the precise selected age, visually
 * distinct (teal, aria-pressed) from an occurrence's time range (FONC-090/100/
 * 110/120/170; OQ-030). A period quick-select (Triassic / Jurassic / Cretaceous)
 * jumps to a representative stage, since the full stage list is long (REQ-003).
 * Keyboard-usable (PERF-230). Period colour dots are meaning-only (charter §4),
 * never the sole signal — each button also carries its name and span as text
 * (PERF-250).
 */

import type { ReactElement } from "react";
import type { GeologicalStage } from "../../domain/index.js";
import { PERIOD_COLOURS } from "../../domain/index.js";
import { formatStageSpan } from "../format.js";
import styles from "./exploration.module.css";

interface TimelineControlProps {
  stages: readonly GeologicalStage[];
  periods: readonly string[];
  selected: string;
  onSelect: (stageName: string) => void;
  onSelectPeriod: (period: string) => void;
}

export function TimelineControl({
  stages,
  periods,
  selected,
  onSelect,
  onSelectPeriod,
}: TimelineControlProps): ReactElement {
  const selectedPeriod = stages.find((s) => s.name === selected)?.period;

  return (
    <nav className={styles.timeline} aria-label="Geological stage timeline">
      <div className={styles.timelineLabel}>
        <span className={styles.statLabel}>Timeline</span>
        <span className={styles.brandSub}>stepped by stage</span>
      </div>
      <div className={styles.timelineBody}>
        <div
          className={styles.periodJump}
          role="group"
          aria-label="Jump to period"
        >
          {periods.map((period) => (
            <button
              key={period}
              type="button"
              className={styles.periodButton}
              aria-pressed={period === selectedPeriod}
              onClick={() => onSelectPeriod(period)}
            >
              <span
                className={styles.stageDot}
                style={{ background: PERIOD_COLOURS[period] ?? "currentColor" }}
                aria-hidden="true"
              />{" "}
              {period}
            </button>
          ))}
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
      </div>
    </nav>
  );
}
