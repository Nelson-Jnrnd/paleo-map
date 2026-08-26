// @vitest-environment node
/**
 * SPEC-017 AMEND-001 + NFR-003 — the fan's labels sit on clade tints, so every
 * tint must clear WCAG 2 AA (4.5:1) against the label colour. axe does not
 * reliably check SVG text contrast, so the guard lives here: without it, a new
 * or retuned clade tint could silently ship an unreadable label.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { CLADE_MARKERS } from "../../src/app/components/mapCladeMarkers.js";

const css = readFileSync("src/app/components/exploration.module.css", "utf8");
const tokens = readFileSync("src/app/styles/tokens.css", "utf8");

/** The token the `.fanLabel` rule paints with. */
function fanLabelToken(): string {
  const rule = css.slice(css.indexOf(".fanLabel"));
  return /fill:\s*var\((--[a-z-]+)\)/.exec(rule)?.[1] ?? "";
}

function tokenValue(name: string): string {
  return new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(tokens)?.[1] ?? "";
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi! + 0.05) / (lo! + 0.05);
}

test("the fan label colour clears AA against every clade tint", () => {
  const token = fanLabelToken();
  expect(token).toBeTruthy();
  const label = tokenValue(token);
  expect(label).toMatch(/^#[0-9a-f]{6}$/i);

  for (const marker of CLADE_MARKERS) {
    const ratio = contrast(label, marker.tint);
    expect(
      ratio,
      `${marker.label} (${marker.tint}) against ${label} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("the nominal body text colour would NOT have been safe here", () => {
  // Documents why the label uses the high-contrast token rather than the
  // ordinary one: four of the seven tints fail AA against --color-text.
  const body = tokenValue("--color-text");
  const failing = CLADE_MARKERS.filter((m) => contrast(body, m.tint) < 4.5);
  expect(failing.length).toBeGreaterThan(0);
});
