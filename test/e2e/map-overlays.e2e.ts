import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * SPEC-023 NFR-001 — the automated non-overlap gate.
 *
 * A layout defect like "the info icon overlaps the legend" cannot be caught by a
 * DOM test: both elements exist, are visible, and are correctly labelled. Only
 * real geometry in a real browser shows the collision. So this spec enumerates
 * boxes rather than naming elements — an overlay added later is covered the
 * moment it becomes a rail child, without anyone remembering to extend a list.
 *
 * `disjoint()` is deliberately exported-by-copy for SPEC-025's cladogram gate:
 * the same 0.5px tolerance and the same viewport matrix, so the two suites agree
 * on what "not overlapping" means.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Sub-pixel tolerance: sub-pixel layout rounding is not a collision. */
export function disjoint(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w <= 0.5 || h <= 0.5;
}

function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}

/** The viewport matrix. The last two give a genuinely narrow map pane, because
 *  the sidebar takes 360px or 42vw, whichever is smaller. */
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 900, height: 700 },
  { width: 820, height: 640 },
];

/** Every persistent overlay box, plus the map library's own controls. */
async function overlayBoxes(
  page: Page,
): Promise<Array<{ name: string; box: Box; locator: Locator }>> {
  const out: Array<{ name: string; box: Box; locator: Locator }> = [];
  const railChildren = page.locator("[data-map-rail] > [data-map-overlay]");
  for (let i = 0; i < (await railChildren.count()); i++) {
    const el = railChildren.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box) {
      out.push({
        name: (await el.getAttribute("data-map-overlay")) ?? "(unnamed)",
        box,
        locator: el,
      });
    }
  }
  const controls = page.locator(".maplibregl-ctrl");
  for (let i = 0; i < (await controls.count()); i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      out.push({ name: `maplibre-ctrl-${i}`, box, locator: el });
    }
  }
  return out;
}

async function settleMap(page: Page): Promise<void> {
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 20_000,
  });
  // Let the overlay pass run against the painted map rather than a mid-load one.
  await page.waitForTimeout(600);
}

for (const viewport of VIEWPORTS) {
  test(`no two map overlays intersect at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settleMap(page);

    const pane = await page.locator("[data-map-pane]").boundingBox();
    expect(pane).not.toBeNull();
    const boxes = await overlayBoxes(page);
    // The gate is worthless if it silently finds nothing to check.
    expect(boxes.length).toBeGreaterThan(1);

    for (const { name, box } of boxes) {
      expect(
        contains(pane as Box, box),
        `${name} escapes the map pane at ${viewport.width}×${viewport.height}`,
      ).toBe(true);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(
          disjoint(a.box, b.box),
          `${a.name} overlaps ${b.name} at ${viewport.width}×${viewport.height}`,
        ).toBe(true);
      }
    }
  });
}

test("every overlay is actually on top at its own centre", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  await page.goto("/");
  await settleMap(page);

  // Containment and non-overlap still allow an overlay to be covered by a
  // full-bleed layer. This checks each one is the element you would actually
  // hit at its centre.
  for (const { name, box } of await overlayBoxes(page)) {
    const owned = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return Boolean(el?.closest("[data-map-overlay], .maplibregl-ctrl"));
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(owned, `${name} is covered at its own centre`).toBe(true);
  }
});

test("UX-001: the clade key collapses and expands on request", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  await page.goto("/");
  await settleMap(page);

  const key = page.locator('[data-map-overlay="clade-key"]');
  await expect(key).toBeVisible();
  const toggle = key.getByRole("button", { name: /clade key/i });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const open = await key.boundingBox();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const closed = await key.boundingBox();
  expect(closed!.height).toBeLessThan(open!.height);

  // Collapsed is a user choice, not a hidden overlay: the label stays readable.
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});
