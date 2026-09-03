import { describe, expect, it } from "vitest";
import {
  FULL_MAX_FRACTION,
  PEEK_HEIGHT_PX,
  SHEET_STOPS,
  advanceStop,
  nearestStop,
  stopForDetail,
  stopHeight,
} from "../../src/app/state/sheet.js";

/**
 * SPEC-030 API-001 / REQ-003 — the sheet's geometry.
 *
 * jsdom cannot do CSS layout, so the *placement* of the sheet is verified by
 * the Playwright suite. What is testable here is the arithmetic those rules
 * depend on, isolated into pure functions for exactly that reason.
 */

describe("advanceStop (API-001)", () => {
  it("cycles peek → half → full → peek", () => {
    expect(advanceStop("peek")).toBe("half");
    expect(advanceStop("half")).toBe("full");
    expect(advanceStop("full")).toBe("peek");
  });

  it("returns to the start after one full cycle from any stop", () => {
    for (const start of SHEET_STOPS) {
      expect(advanceStop(advanceStop(advanceStop(start)))).toBe(start);
    }
  });
});

describe("stopHeight (REQ-003)", () => {
  const container = 480;

  it("keeps the map at least 25% of the container at the full stop", () => {
    const full = stopHeight("full", container);
    expect(container - full).toBeGreaterThanOrEqual(container * 0.25 - 0.5);
    expect(full).toBeCloseTo(container * FULL_MAX_FRACTION);
  });

  it("shows the handle and the in-view count at peek", () => {
    expect(stopHeight("peek", container)).toBe(PEEK_HEIGHT_PX);
  });

  it("keeps the map's 55% at peek on a container too short for the fixed peek", () => {
    // 320×568 leaves a ~200px container. Clamping the 152px peek against the
    // *full* fraction instead of this one left the map at 25% there — criterion
    // 1 violated at a width the gate did not check.
    for (const px of [180, 200, 240, 275]) {
      const visibleMap = px - stopHeight("peek", px);
      expect(visibleMap / px).toBeGreaterThanOrEqual(0.55 - 1e-9);
    }
  });

  it("leaves the map the majority of the container at peek", () => {
    // REQ-003 acceptance criterion 1: at least 55% of the space below the
    // timeline is still map when the sheet is resting.
    const visibleMap = container - stopHeight("peek", container);
    expect(visibleMap / container).toBeGreaterThanOrEqual(0.55);
  });

  it("orders the stops peek ≤ half ≤ full at every container height", () => {
    // Including containers short enough that the fixed peek would otherwise
    // exceed the capped full stop — a drag must never be able to invert them.
    for (const px of [0, 80, 150, 200, 320, 480, 900]) {
      const peek = stopHeight("peek", px);
      const half = stopHeight("half", px);
      const full = stopHeight("full", px);
      expect(peek).toBeLessThanOrEqual(half + 1e-9);
      expect(half).toBeLessThanOrEqual(full + 1e-9);
    }
  });

  it("returns zero for a container that has not been measured yet", () => {
    expect(stopHeight("half", 0)).toBe(0);
  });
});

describe("nearestStop (REQ-003)", () => {
  const container = 480;

  it("settles a drag on whichever stop is closest", () => {
    expect(nearestStop(0, container)).toBe("peek");
    expect(nearestStop(stopHeight("half", container), container)).toBe("half");
    expect(nearestStop(container, container)).toBe("full");
  });

  it("never rests between stops", () => {
    for (let h = 0; h <= container; h += 7) {
      const settled = nearestStop(h, container);
      expect(SHEET_STOPS).toContain(settled);
    }
  });

  it("settles by distance, not by drag direction", () => {
    // Just short of full, having dragged upward: the reader expects full.
    const nearlyFull = stopHeight("full", container) - 6;
    expect(nearestStop(nearlyFull, container)).toBe("full");
  });
});

describe("stopForDetail (REQ-004)", () => {
  it("raises a peeking sheet so the detail is not opened into a 152px slot", () => {
    expect(stopForDetail("peek")).toBe("half");
  });

  it("leaves a sheet where the reader put it", () => {
    expect(stopForDetail("half")).toBe("half");
    expect(stopForDetail("full")).toBe("full");
  });
});
