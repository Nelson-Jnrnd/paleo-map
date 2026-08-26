// @vitest-environment jsdom
/**
 * SPEC-023 NFR-002 — the structural half of the corner-rail scheme, guarded
 * without a browser so a violation is caught in the fast job rather than in the
 * Playwright run.
 *
 * Geometry is not asserted here (jsdom has no layout): NFR-001's Playwright gate
 * owns non-overlap. What this file owns is the *scheme* — that every persistent
 * overlay is a rail child, that rails are unique per corner, that children carry
 * stable names, that no child re-anchors itself, and that the reserved corner
 * stays empty of app overlays.
 */
import { afterEach, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

const css = readFileSync("src/app/components/exploration.module.css", "utf8");

async function renderMap(): Promise<HTMLElement> {
  const api = await fixtureApi();
  const { container } = render(<ExplorationView api={api} />);
  const pane = container.querySelector("[data-map-pane]");
  expect(pane).not.toBeNull();
  return pane as HTMLElement;
}

test("REQ-001: at most one rail per corner, and no empty rail renders", async () => {
  const pane = await renderMap();
  const rails = [...pane.querySelectorAll("[data-map-rail]")];
  const corners = rails.map((r) => r.getAttribute("data-map-rail"));
  expect(new Set(corners).size).toBe(corners.length);
  for (const corner of corners) {
    expect(["top-left", "bottom-left", "bottom-right"]).toContain(corner);
  }
  // A rail that rendered with no children would be an empty bordered box.
  for (const rail of rails) expect(rail.children.length).toBeGreaterThan(0);
});

test("REQ-002: the top-right corner is reserved — no app overlay may claim it", async () => {
  const pane = await renderMap();
  expect(pane.querySelector('[data-map-rail="top-right"]')).toBeNull();
  // The gate toggle in particular moved out of that corner.
  const gate = pane.querySelector('[data-map-overlay="wikipedia-gate"]');
  expect(gate).not.toBeNull();
  expect(gate?.closest("[data-map-rail]")?.getAttribute("data-map-rail")).toBe(
    "bottom-right",
  );
});

test("REQ-001: every rail child carries a stable, non-empty overlay name", async () => {
  const pane = await renderMap();
  const children = [...pane.querySelectorAll("[data-map-rail] > *")];
  expect(children.length).toBeGreaterThan(0);
  for (const child of children) {
    expect(child.getAttribute("data-map-overlay")?.trim()).toBeTruthy();
  }
});

test("REQ-001: no rail child sets its own corner offsets", () => {
  // The rail owns the corner. A child that re-anchors itself is the exact defect
  // this scheme removes, so it is asserted against the stylesheet.
  for (const cls of [
    "wikiGateToggle",
    "basemapAttribution",
    "mapLegend2",
  ] as const) {
    const block = css.match(new RegExp(`\\.${cls} \\{[^}]*\\}`))?.[0] ?? "";
    expect(block).not.toBe("");
    expect(block).not.toMatch(/position:\s*absolute/);
    expect(block).not.toMatch(/^\s*(top|right|bottom|left):/m);
  }
});

test("REQ-005: the transient card layer paints above the rails", () => {
  const rail = css.match(/\.mapRail \{[^}]*\}/)?.[0] ?? "";
  const overlay = css.match(/\.mapOverlay \{[^}]*\}/)?.[0] ?? "";
  const z = (block: string): number =>
    Number(block.match(/z-index:\s*(\d+)/)?.[1] ?? "0");
  expect(z(overlay)).toBeGreaterThan(z(rail));
});

test("UX-001: the clade key collapses on request, and nothing else does", async () => {
  const user = userEvent.setup();
  const pane = await renderMap();
  // jsdom has no WebGL, so the map falls back and the clade key does not mount;
  // the collapse affordance is exercised in the browser gate. What must hold
  // here is that no *other* overlay offers a collapse control.
  const disclosures = [...pane.querySelectorAll("[data-map-overlay]")].filter(
    (el) =>
      el.getAttribute("data-map-overlay") !== "clade-key" &&
      el.querySelector("[aria-expanded]") !== null,
  );
  const names = disclosures.map((d) => d.getAttribute("data-map-overlay"));
  // The basemap ⓘ is a popover, not a collapse of itself — it is allowed.
  expect(names.filter((n) => n !== "basemap-attribution")).toEqual([]);
  expect(screen.queryByRole("button", { name: /clade key/i })).toBeNull();
  await user.tab();
});

test("REQ-002: the map pane is the single positioning context for rails", async () => {
  const pane = await renderMap();
  for (const rail of pane.querySelectorAll("[data-map-rail]")) {
    expect(rail.parentElement).toBe(pane);
  }
  const block = css.match(/\.mapPane \{[^}]*\}/)?.[0] ?? "";
  expect(block).toMatch(/position:\s*relative/);
});
