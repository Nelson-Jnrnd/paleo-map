/**
 * The global app bar (SPEC-022 REQ-001…REQ-004). One bar on all four screens,
 * rendered once by the shell rather than by each screen, so the return path is
 * the same object everywhere instead of four bespoke "← Back to map" buttons.
 *
 * It carries the wordmark and exactly three destinations — Map, Dinordle,
 * Taxonomy. The taxon page is deliberately *not* a destination: it is a detail
 * view reached from within the map loop, the Dinordle reveal or the taxonomy
 * screen, so on that screen no destination is marked current (REQ-003).
 *
 * The destinations are `<button>`s, not links, because these screens have no
 * URLs — the fragment vocabulary is frozen to the puzzle's own addresses
 * (SPEC-022 API-001) and the map, taxonomy and profile screens are deliberately
 * not addressable.
 */

import type { ReactElement } from "react";
import styles from "./exploration.module.css";

/** The three navigable destinations. The profile screen is not one of them. */
export type Destination = "map" | "daily" | "taxonomy";

/** Which screen is showing — `profile` marks no destination current (REQ-003). */
export type BarScreen = Destination | "profile";

const DESTINATIONS: ReadonlyArray<{ id: Destination; label: string }> = [
  { id: "map", label: "Map" },
  { id: "daily", label: "Dinordle" },
  { id: "taxonomy", label: "Taxonomy" },
];

interface AppBarProps {
  screen: BarScreen;
  onNavigate: (destination: Destination) => void;
}

export function AppBar({ screen, onNavigate }: AppBarProps): ReactElement {
  return (
    <div className={styles.appBar}>
      {/* Not a heading: the page's h1 belongs to the screen's own subject, and a
          wordmark repeated on every screen is not that subject (REQ-001). */}
      <span className={styles.wordmark}>Mesozoic Dinosaur Atlas</span>
      <nav className={styles.appNav} aria-label="Main">
        {DESTINATIONS.map((d) => {
          const current = screen === d.id;
          return (
            <button
              key={d.id}
              type="button"
              className={`${styles.navLink} ${current ? styles.navCurrent : ""}`}
              // Weight + a rule carry "current" alongside the colour, so the
              // state survives with colour removed (charter §4, PERF-250).
              {...(current ? { "aria-current": "page" as const } : {})}
              onClick={() => onNavigate(d.id)}
            >
              {d.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
