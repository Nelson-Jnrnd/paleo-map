/**
 * The occurrence sheet (SPEC-030 REQ-003, REQ-004).
 *
 * The phone form of SPEC-026's sidebar column. Not a different surface — the
 * *same* column contents, in a container that can be dragged over a full-bleed
 * map instead of standing beside a 226px one. SPEC-026 AMEND-001 records that
 * "the column" now reads as "the column, which on a phone is the sheet"; every
 * behaviour of REQ-001/REQ-003 there holds here unchanged.
 *
 * Deliberately **not** a modal: the map behind stays interactive at every stop,
 * focus is not trapped, and nothing is inert. A reader panning the map with the
 * list open is the normal case, not an edge one.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  advanceStop,
  nearestStop,
  stopForDetail,
  stopHeight,
} from "../state/sheet.js";
import type { SheetStop } from "../state/sheet.js";
import styles from "./exploration.module.css";

interface OccurrenceSheetProps {
  children: ReactNode;
  /** Accessible name for the region — the same one the sidebar carries. */
  label: string;
  /**
   * Set when a detail is open (REQ-004). A detail opening while the sheet peeks
   * raises it to half, so what the reader just tapped is not buried in a 152px
   * slot. Passing the key rather than a boolean means re-selecting a *different*
   * row also raises it.
   */
  detailKey: string | null;
}

export function OccurrenceSheet({
  children,
  label,
  detailKey,
}: OccurrenceSheetProps): React.ReactElement {
  const [stop, setStop] = useState<SheetStop>("peek");
  const [containerPx, setContainerPx] = useState(0);
  /** Live height during a drag; null when resting at `stop`. */
  const [dragPx, setDragPx] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startPx: number;
  } | null>(null);

  // Measure the container the stops are fractions of — the space below the
  // timeline. Remeasured on resize and on rotation, so a stop is never a stale
  // pixel offset from the previous viewport (REQ-003 edge case).
  useEffect(() => {
    const el = sheetRef.current?.parentElement;
    if (!el) return;
    const measure = (): void =>
      setContainerPx(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (detailKey !== null) setStop((current) => stopForDetail(current));
  }, [detailKey]);

  const settle = useCallback(
    (px: number) => {
      setStop(nearestStop(px, containerPx));
      setDragPx(null);
    },
    [containerPx],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPx: stopHeight(stop, containerPx),
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a best-effort enhancement, as on the timeline track */
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Dragging up (a decreasing clientY) grows the sheet.
    const next = drag.startPx + (drag.startY - event.clientY);
    setDragPx(Math.max(0, Math.min(containerPx, next)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // `pointercancel` as well as `pointerup`: a call, an app switch or a lost
    // pointer must still settle the sheet rather than strand it mid-drag.
    settle(dragPx ?? drag.startPx);
  };

  // A tap on the handle — and Enter/Space on it, since it is a real button —
  // advances to the next stop. That is the whole keyboard story: the sheet is
  // operable without a drag gesture (REQ-003 acceptance criterion 4).
  const onClick = (): void => {
    if (dragRef.current) return;
    setStop(advanceStop(stop));
  };

  const heightPx = dragPx ?? stopHeight(stop, containerPx);

  // Publish the sheet's live height to the container as a custom property, so
  // the map's bottom rails can sit just above it (SPEC-030 REQ-007 clause 2).
  //
  // Written imperatively rather than lifted into React state on purpose: the
  // value changes on every frame of a drag, and routing that through the parent
  // would re-render the map with it. It is also the *actual* height, not the
  // nominal peek — `stopHeight` clamps peek on a short viewport, and a rail
  // offset by the nominal 152px while the sheet rendered at 132px pushed all
  // three overlays up out of the map pane at 320×568.
  useEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    parent.style.setProperty("--sheet-height", `${Math.round(heightPx)}px`);
  }, [heightPx]);

  return (
    <section
      ref={sheetRef}
      className={styles.sheet}
      aria-label={label}
      data-sheet-stop={stop}
      data-dragging={dragPx === null ? undefined : "true"}
      style={containerPx > 0 ? { height: `${heightPx}px` } : undefined}
    >
      <button
        type="button"
        className={styles.sheetHandle}
        // The control's job is stated in words for a screen reader; the grip is
        // decorative. Naming the next stop would go stale mid-drag.
        aria-label={`Occurrence list, ${stop} — activate to resize`}
        aria-expanded={stop !== "peek"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
      >
        <span className={styles.sheetGrip} aria-hidden="true" />
      </button>
      <div className={styles.sheetBody}>{children}</div>
    </section>
  );
}
