import { expect, test } from "@playwright/test";
import { disjoint } from "./geometry.js";

/**
 * SPEC-025 NFR-001 — the cladogram's non-overlap gate.
 *
 * `disjoint()` is imported from the shared `./geometry.ts` that SPEC-023's
 * overlay gate also uses, rather than restated, so the two suites cannot drift on
 * the 0.5px tolerance or on what "not overlapping" means.
 *
 * The claim under test is the one the layout is built to guarantee: one label per
 * row, so no two labels can collide — at any viewport, at any lineage depth the
 * shipped snapshot can produce.
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 820, height: 640 },
];

async function openPuzzle(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/#daily");
  await page.getByLabel("Guess a genus").waitFor();
}

/** Play several real guesses so the diagram carries branches and leaves. */
async function playSome(
  page: import("@playwright/test").Page,
  names: string[],
): Promise<void> {
  for (const name of names) {
    const input = page.getByLabel("Guess a genus");
    await input.fill(name);
    await page.getByRole("button", { name: /guess/i }).click();
    await page.waitForTimeout(120);
  }
}

for (const viewport of VIEWPORTS) {
  test(`no two cladogram labels overlap at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPuzzle(page);
    await playSome(page, [
      "Triceratops",
      "Diplodocus",
      "Velociraptor",
      "Gorgosaurus",
    ]);

    const labels = page.locator('[class*="diagram"] [class*="nodeName"]');
    const count = await labels.count();
    // A gate that finds nothing proves nothing.
    expect(count).toBeGreaterThan(3);

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await labels.nth(i).boundingBox();
      const text = (await labels.nth(i).textContent()) ?? `label ${i}`;
      if (box) boxes.push({ text, box });
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(
          disjoint(a.box, b.box),
          `"${a.text}" overlaps "${b.text}" at ${viewport.width}×${viewport.height}`,
        ).toBe(true);
      }
    }
  });
}

test("UX-001: no label wraps or is truncated; the region scrolls instead", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 640 });
  await openPuzzle(page);
  await playSome(page, ["Triceratops", "Diplodocus", "Velociraptor"]);

  const region = page.getByRole("region", { name: /cladogram/i });
  await expect(region).toBeVisible();

  // Every label is one line: its height is a single line box, and its text is
  // never ellipsised.
  const labels = page.locator('[class*="diagram"] [class*="nodeName"]');
  for (let i = 0; i < (await labels.count()); i++) {
    const el = labels.nth(i);
    const info = await el.evaluate((n) => {
      const s = getComputedStyle(n as HTMLElement);
      return {
        whiteSpace: s.whiteSpace,
        textOverflow: s.textOverflow,
        scrollW: (n as HTMLElement).scrollWidth,
        clientW: (n as HTMLElement).clientWidth,
      };
    });
    expect(info.whiteSpace).toBe("nowrap");
    expect(info.textOverflow).not.toBe("ellipsis");
    // Not clipped: the label's own box holds all of its text.
    expect(info.scrollW - info.clientW).toBeLessThanOrEqual(1);
  }

  // The region itself is what scrolls, and it is keyboard-reachable.
  const scrollable = await region.evaluate(
    (n) => getComputedStyle(n as HTMLElement).overflowX,
  );
  expect(["auto", "scroll"]).toContain(scrollable);
  await expect(region).toHaveAttribute("tabindex", "0");
});

test("REQ-004: nothing is drawn below the last row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPuzzle(page);

  // A fresh round is a single root row, with no continuation after it.
  await expect(page.getByText(/the descent continues/i)).toHaveCount(0);
  await expect(page.getByText(/unresolved/i)).toHaveCount(0);
  const labels = page.locator('[class*="diagram"] [class*="nodeName"]');
  await expect(labels).toHaveCount(1);
  await expect(labels.first()).toHaveText("Dinosauria");
});
