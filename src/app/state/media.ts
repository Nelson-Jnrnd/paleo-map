/**
 * Viewport and pointer queries, as hooks (SPEC-030 API-001).
 *
 * The two conditions are deliberately independent, and the app treats them that
 * way: a desktop browser narrowed below 40rem gets the phone *layout*
 * (width-driven) but keeps the 24px target floor (pointer-driven), and a touch
 * laptop gets the targets without the layout. Collapsing them into one "is
 * mobile" flag would be wrong for both.
 *
 * The CSS media queries are the source of truth for anything that can be done in
 * CSS. These exist only for the behaviour CSS cannot express — raising the sheet
 * when a marker is tapped, and the clade key's initial state.
 */

import { useEffect, useState } from "react";

/** SPEC-030 REQ-001: the single phone breakpoint, matching tokens.css. */
export const PHONE_QUERY = "(max-width: 40rem)";
const COARSE_QUERY = "(pointer: coarse)";

function subscribe(query: string): {
  get: () => boolean;
  on: (fn: () => void) => () => void;
} {
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  return {
    // Without `matchMedia` the hook reports false and the app renders the
    // fine-pointer, wide layout. The CSS queries are independent of this, so the
    // layout is still correct — only the JS-side refinements degrade.
    get: () => (supported ? window.matchMedia(query).matches : false),
    on: (fn) => {
      if (!supported) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", fn);
      return () => mql.removeEventListener("change", fn);
    },
  };
}

function useMediaQuery(query: string): boolean {
  const media = subscribe(query);
  const [matches, setMatches] = useState(media.get);
  useEffect(() => {
    const m = subscribe(query);
    // Re-read on mount: the viewport can change between the first render and
    // the effect, and a stale `false` would put the sheet in the wrong place.
    setMatches(m.get());
    return m.on(() => setMatches(m.get()));
  }, [query]);
  return matches;
}

/** True at or below the 40rem breakpoint — the phone layout is in force. */
export function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** True where the primary pointer is coarse — a finger, not a mouse. */
export function usePointerCoarse(): boolean {
  return useMediaQuery(COARSE_QUERY);
}
