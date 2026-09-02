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
 * The stage track behaves as a single slider: it can be **dragged** (press and
 * hold the track, then move to scrub the selected age), and only the selected step
 * is in the tab order (roving tabindex), with Arrow/Home/End moving the selection
 * to the adjacent older/younger stage — one tab stop, keyboard-steppable
 * (PERF-230). Each step is still a real `<button>` with `aria-pressed`, and the
 * selected stage name + Ma span are always shown as text (never hover-only).
 *
 * The selected age is marked by a thin bar riding just above the track (never a
 * bulky block), and a selected occurrence/taxon's temporal extent is drawn as a
 * translucent bracketed band across the stages it spans (SPEC-009 REQ-005).
 */

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const shouldFocus = useRef(false);

  // Pointer drag: press-and-hold anywhere on the track, then move to scrub the
  // selected age (the control acts as a real slider, not a row of buttons). A
  // small movement threshold keeps a plain click delegating to the step button's
  // own onClick, so click/keyboard selection is unchanged. Selection is derived
  // from the pointer's x-position mapped back to Ma, so it works whether the
  // pointer is over a step or the gaps between them.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    dragging: boolean;
  } | null>(null);
  const DRAG_THRESHOLD_PX = 3;

  const stageNameAtClientX = (clientX: number): string | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const fraction = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    const ma = windowMaxMa - fraction * windowSpan;
    let best: GeologicalStage | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const s of stages) {
      if (ma <= s.startMa && ma >= s.endMa) return s.name;
      const centre = (s.startMa + s.endMa) / 2;
      const dist = Math.abs(centre - ma);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best?.name ?? null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging) {
      if (Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      // Capture so the scrub keeps tracking even if the pointer leaves the track;
      // guarded because it throws where the pointer isn't active (older engines).
      try {
        trackRef.current?.setPointerCapture(drag.pointerId);
      } catch {
        /* capture is a best-effort enhancement */
      }
    }
    event.preventDefault();
    const name = stageNameAtClientX(event.clientX);
    if (name && name !== selected) onSelect(name);
  };

  const endDrag = (): void => {
    const drag = dragRef.current;
    if (drag?.dragging) {
      try {
        trackRef.current?.releasePointerCapture(drag.pointerId);
      } catch {
        /* mirror of setPointerCapture's guard */
      }
    }
    dragRef.current = null;
  };

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

  // SPEC-030 REQ-006: the discrete stepping controls. `stages` runs oldest →
  // youngest, so "older" is one index down and "younger" one up — the same
  // ordering the keyboard slider uses, derived here rather than duplicated.
  const selectedIndex = stages.findIndex((s) => s.name === selected);
  const olderStage = selectedIndex > 0 ? stages[selectedIndex - 1] : undefined;
  const youngerStage =
    selectedIndex >= 0 && selectedIndex < stages.length - 1
      ? stages[selectedIndex + 1]
      : undefined;

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
        {/* SPEC-030 REQ-006: precise stage selection on a coarse pointer. The
            to-scale track cannot carry it — ~30 stages across a 214px track
            gives a narrowest step of 0.0px, and 30 × 44px is 1,320px, which no
            phone has. These are hidden above the breakpoint (NFR-002), and at
            the ends of the range they are disabled with a reason rather than
            hidden (charter §7). Words, not an icon alone. */}
        <button
          type="button"
          className={`${styles.stageStepper} ${styles.stepOlder}`}
          // The destination stays in the title, not the accessible name: naming
          // it here made two buttons answer to "Campanian" — this control and
          // the Campanian step itself — which is ambiguous to a screen reader
          // and to anything else querying by name. The readout announces where
          // the step landed.
          aria-label="Older stage"
          disabled={!olderStage}
          title={
            olderStage
              ? `Older stage · ${olderStage.name}`
              : "Already at the oldest stage in the window"
          }
          onClick={() => selectByIndex(selectedIndex - 1)}
        >
          Older
        </button>
        <button
          type="button"
          className={`${styles.stageStepper} ${styles.stepYounger}`}
          aria-label="Younger stage"
          disabled={!youngerStage}
          title={
            youngerStage
              ? `Younger stage · ${youngerStage.name}`
              : "Already at the youngest stage in the window"
          }
          onClick={() => selectByIndex(selectedIndex + 1)}
        >
          Younger
        </button>

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

        {/* Disclose that a period jumps to its most fossil-rich stage, so
            landing on (e.g.) the Rhaetian for the Triassic reads as intended
            rather than arbitrary (SPEC-011 REQ-006, AMEND-001; owner decision
            a). Static text, not a hover, per the charter's "always legible". */}

        <div
          className={styles.stageTrack}
          aria-hidden="false"
          role="presentation"
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          {selectedStage &&
            (() => {
              const { left, width } = extent(
                selectedStage.startMa,
                selectedStage.endMa,
                windowMaxMa,
                windowSpan,
              );
              return (
                <span
                  className={styles.selectionBar}
                  aria-hidden="true"
                  style={{ left: pct(left), width: pct(width) }}
                />
              );
            })()}
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
                // SPEC-030 UX-001 exempts the to-scale steps from the 44px
                // coarse-pointer floor by ID rather than by accident: 30 stages
                // × 44px is 1,320px, which no phone has, and forcing it here
                // pushes the absolutely-positioned steps past the viewport.
                // Precise stage selection is served by REQ-006's discrete
                // controls; these keep PERF-120's 24px height.
                data-stage-step
                aria-pressed={isSelected}
                aria-label={`${stage.name}, ${formatStageSpan(stage)}`}
                title={`${stage.name} · ${formatStageSpan(stage)}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(stage.name)}
                onKeyDown={onKeyDown}
              >
                <span
                  className={styles.stageStepFill}
                  style={{ background: stage.periodColour }}
                  aria-hidden="true"
                />
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
