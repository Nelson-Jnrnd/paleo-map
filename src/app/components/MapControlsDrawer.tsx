/**
 * The phone map screen's controls drawer (SPEC-030 REQ-005/REQ-006 as amended).
 *
 * Holds what the age strip does not: the taxon search, the full to-scale
 * timeline, the map frame toggle and Reset view. Closed by default, so the map
 * has the screen.
 *
 * Deliberately a **disclosure, not a modal**. It expands in normal flow above
 * the map rather than floating over it, so there is no focus trap, no scrim, no
 * `inert`, and no way to end up with the map operable underneath a panel that
 * has swallowed the keyboard. That also means the map simply gets its space back
 * when the drawer closes, with no animation to get wrong.
 */

import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import styles from "./exploration.module.css";

interface MapControlsDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Reset the map view (SPEC-022 REQ-006). It lives in the head rather than in
   * the context row below because at 320px the row could not hold the frame
   * choice and Reset together — 299px of controls in 296px — so Reset wrapped
   * onto a 44px row of its own and the drawer grew to 358px of a 568px screen.
   * The head row had the space already.
   */
  onReset: () => void;
  children: ReactNode;
}

export function MapControlsDrawer({
  open,
  onClose,
  onReset,
  children,
}: MapControlsDrawerProps): ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null);

  // Opening moves focus into the panel, so a keyboard or screen-reader user
  // lands on the controls they asked for rather than continuing from the strip.
  //
  // Escape closes, matching every other dismissible surface in the app
  // (SPEC-026 REQ-003's column). Bound natively rather than as a JSX prop: this
  // container is a `group`, not an interactive element, and attaching key
  // handlers to one is exactly what `jsx-a11y/no-noninteractive-element-
  // interactions` is warning about. The listener does the same job without
  // claiming the element is interactive — and it is not a trap, Tab still
  // leaves normally.
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    el.focus();
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={styles.controlsDrawer}
      role="group"
      aria-label="Age, search and map controls"
      tabIndex={-1}
    >
      {/* A title and its close, at the top, so the panel reads as one thing.
          "Done" alone at the bottom floated under the timeline with nothing
          tying it to what it closed. */}
      <div className={styles.drawerHead}>
        <span className={styles.drawerTitle}>Age, search &amp; map</span>
        <button type="button" className={styles.drawerReset} onClick={onReset}>
          Reset view
        </button>
        <button type="button" className={styles.drawerClose} onClick={onClose}>
          Done
        </button>
      </div>
      {children}
    </div>
  );
}
