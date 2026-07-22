/**
 * To-scale stepped timeline slider (SPEC-009 REQ-001/002; SPEC-003 REQ-004;
 * SPEC-008 REQ-002/003). The selected age still steps by geological **stage**, but
 * the steps are now placed and sized **in proportion to their duration in Ma**
 * across the full Mesozoic window (oldest left → youngest right), so the control
 * reads as a timescale. Three large, labelled period delimitations (Triassic /
 * Jurassic / Cretaceous) sit above the track and double as the SPEC-008 REQ-003
 * quick-select; they carry their name as text and their ICS colour (meaning-only,
 * never colour-alone — charter §4, PERF-250).
 *
 * The stage track behaves as a single slider: only the selected step is in the tab
 * order (roving tabindex), and Arrow/Home/End move the selection to the adjacent
 * older/younger stage — one tab stop, keyboard-steppable (PERF-230). Each step is
 * still a real `<button>` with `aria-pressed`, and the selected stage name + Ma
 * span are always shown as text (never hover-only).
 */

import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { GeologicalStage, TimeRange } from "../../domain/index.js";
import { PERIOD_COLOURS } from "../../domain/index.js";
import { formatStageSpan } from "../format.js";
import styles from "./exploration.module.css";

interface TimelineControlProps {
  stages: readonly GeologicalStage[];
  periods: readonly string[];
  selected: string;
  onSelect: (stageName: string) => void;
  onSelectPeriod: (period: string) => void;
  /**
   * Time range of the currently selected occurrence — highlighted on the frieze
   * (band + period ring) so the selection's temporal extent is visible (SPEC-009
   * REQ-005). Null when no occurrence is selected.
   */
  highlightRange?: TimeRange | null;
}

/** Fractional left offset + width (0…1) of a [maxMa, minMa] span on the track. */
function extent(
  maxMa: number,
  minMa: number,
  windowMaxMa: number,
  windowSpan: number,
): { left: number; width: number } {
  return {
    left: (windowMaxMa - maxMa) / windowSpan,
    width: (maxMa - minMa) / windowSpan,
  };
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(3)}%`;
}

export function TimelineControl({
  stages,
  periods,
  selected,
  onSelect,
  onSelectPeriod,
  highlightRange = null,
}: TimelineControlProps): ReactElement {
  // The full window: oldest stage's older bound → youngest stage's younger bound.
  const windowMaxMa = stages.reduce((m, s) => Math.max(m, s.startMa), 0);
  const windowMinMa = stages.reduce(
    (m, s) => Math.min(m, s.endMa),
    Number.POSITIVE_INFINITY,
  );
  const windowSpan = windowMaxMa - windowMinMa || 1;

  // Ma graduation ticks at round values inside the window (REQ-001). 25 Ma steps
  // give a readable density across the ~186 Myr Mesozoic; oldest (largest Ma) left.
  const TICK_STEP_MA = 25;
  const ticks: number[] = [];
  for (
    let ma = Math.ceil(windowMinMa / TICK_STEP_MA) * TICK_STEP_MA;
    ma <= windowMaxMa;
    ma += TICK_STEP_MA
  ) {
    ticks.push(ma);
  }

  const selectedStage = stages.find((s) => s.name === selected);
  const selectedPeriod = selectedStage?.period;

  // Roving focus: after a keyboard step re-selects a stage, move focus to the
  // newly-selected step so the single-tab-stop slider keeps focus with it.
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (shouldFocus.current) {
      selectedRef.current?.focus();
      shouldFocus.current = false;
    }
  }, [selected]);

  const selectByIndex = (index: number): void => {
    const clamped = Math.min(stages.length - 1, Math.max(0, index));
    const next = stages[clamped];
    if (next && next.name !== selected) {
      shouldFocus.current = true;
      onSelect(next.name);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = stages.findIndex((s) => s.name === selected);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        selectByIndex(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        selectByIndex(index - 1);
        break;
      case "Home":
        event.preventDefault();
        selectByIndex(0);
        break;
      case "End":
        event.preventDefault();
        selectByIndex(stages.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <nav className={styles.timeline} aria-label="Geological stage timeline">
      <div className={styles.timelineLabel}>
        <span className={styles.statLabel}>Timeline</span>
        <span className={styles.timelineReadout}>
          <span className={styles.timelineReadoutName}>{selected}</span>
          {selectedStage && (
            <span className={`${styles.timelineReadoutSpan} mono`}>
              {formatStageSpan(selectedStage)}
            </span>
          )}
        </span>
      </div>

      <div className={styles.timelineBody}>
        <div
          className={styles.periodBands}
          role="group"
          aria-label="Jump to period"
        >
          {periods.map((period) => {
            const inPeriod = stages.filter((s) => s.period === period);
            if (inPeriod.length === 0) return null;
            const maxMa = inPeriod.reduce((m, s) => Math.max(m, s.startMa), 0);
            const minMa = inPeriod.reduce(
              (m, s) => Math.min(m, s.endMa),
              Number.POSITIVE_INFINITY,
            );
            const { left, width } = extent(
              maxMa,
              minMa,
              windowMaxMa,
              windowSpan,
            );
            const inRange = highlightRange
              ? Math.max(minMa, highlightRange.minMa) <
                Math.min(maxMa, highlightRange.maxMa)
              : false;
            return (
              <button
                key={period}
                type="button"
                className={styles.periodBand}
                style={{ left: pct(left), width: pct(width) }}
                aria-pressed={period === selectedPeriod}
                data-inrange={inRange ? "true" : undefined}
                onClick={() => onSelectPeriod(period)}
              >
                <span
                  className={styles.stageDot}
                  style={{
                    background: PERIOD_COLOURS[period] ?? "currentColor",
                  }}
                  aria-hidden="true"
                />{" "}
                {period}
              </button>
            );
          })}
        </div>

        <div
          className={styles.stageTrack}
          aria-hidden="false"
          role="presentation"
        >
          {highlightRange &&
            (() => {
              const hiMax = Math.min(highlightRange.maxMa, windowMaxMa);
              const hiMin = Math.max(highlightRange.minMa, windowMinMa);
              if (hiMax <= hiMin) return null;
              return (
                <span
                  className={styles.rangeHighlight}
                  aria-hidden="true"
                  style={{
                    left: pct((windowMaxMa - hiMax) / windowSpan),
                    width: pct((hiMax - hiMin) / windowSpan),
                  }}
                />
              );
            })()}
          {stages.map((stage) => {
            const isSelected = stage.name === selected;
            const { left, width } = extent(
              stage.startMa,
              stage.endMa,
              windowMaxMa,
              windowSpan,
            );
            return (
              <button
                key={stage.name}
                type="button"
                ref={isSelected ? selectedRef : undefined}
                className={styles.stageStep}
                style={{ left: pct(left), width: pct(width) }}
                aria-pressed={isSelected}
                aria-label={`${stage.name}, ${formatStageSpan(stage)}`}
                title={`${stage.name} · ${formatStageSpan(stage)}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(stage.name)}
                onKeyDown={onKeyDown}
              >
                <span
                  className={styles.stageStepFill}
                  style={
                    isSelected ? undefined : { background: stage.periodColour }
                  }
                  aria-hidden="true"
                />
                {isSelected && (
                  <span className={styles.stageThumb} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Ma graduation — decorative scale; the selected age is announced via the
            readout and the stage buttons, so the axis is hidden from a11y. */}
        <div className={styles.stageAxis} aria-hidden="true">
          {ticks.map((ma) => (
            <span
              key={ma}
              className={styles.axisTick}
              style={{ left: pct((windowMaxMa - ma) / windowSpan) }}
            >
              <span className={`${styles.axisTickLabel} mono`}>{ma}</span>
            </span>
          ))}
          <span className={styles.axisUnit}>Ma</span>
        </div>
      </div>
    </nav>
  );
}
