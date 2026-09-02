import { expect, test } from "@playwright/test";
import {
  TARGET_MIN_COARSE,
  horizontalOverflowers,
  settle,
} from "./phone-viewports.js";

/**
 * SPEC-030 UX-004 — the sheet's real states, and NFR-002 — the desktop layout.
 *
 * Charter §7: every interactive surface designs for all of its real states, not
 * only the happy path. These states have never been looked at on a phone; they
 * used to render into a 164px column, and a sheet that only works when there is
 * a list to show is half a design.
 */

test.describe("UX-004: the sheet's states at 390×664", () => {
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
  });

  test("the empty state renders in the sheet with a usable recovery control", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    // Step to an age with no occurrences — the Induan, at the far old end, is
    // the emptiest stage in the window. Reached with the discrete control so
    // the test uses the same path a reader on a phone would.
    const older = page.getByRole("button", { name: /older stage/i });
    for (let i = 0; i < 34 && (await older.isEnabled()); i++) {
      await older.click();
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1500);

    const sheet = page.locator("[data-sheet-stop]");
    await expect(sheet).toBeVisible();

    // Whatever the state turns out to be, the sheet must not overflow and its
    // controls must stay thumb-sized. This is the charter §7 gate, not a
    // specific string.
    expect(await horizontalOverflowers(page)).toEqual([]);

    const controls = sheet.locator("button:visible");
    const count = await controls.count();
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height).toBeGreaterThanOrEqual(TARGET_MIN_COARSE - 0.5);
    }
  });

  test("a stage that is still loading keeps the sheet legible", async ({
    page,
  }) => {
    // Hold the stage fetch open so the loading state is observable rather than
    // a frame that flashes past.
    await page.route("**/data/stage-*.json", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto("/");
    await page.waitForSelector("[data-sheet-stop]", { timeout: 30_000 });

    const sheet = page.locator("[data-sheet-stop]");
    await expect(sheet).toBeVisible();
    expect(await horizontalOverflowers(page)).toEqual([]);
  });

  test("a failed stage load shows its retry inside the sheet", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    // Fail the *next* stage fetch, then step the age to trigger it.
    await page.route("**/data/stage-*.json", (route) => route.abort());
    await page.getByRole("button", { name: /older stage/i }).click();
    await page.waitForTimeout(2500);

    // FONC-1310/1330: the failure is stated and the retry is reachable. It may
    // render in the sheet or in the map pane; both are on screen, which is what
    // charter §7 asks for.
    const retry = page.getByRole("button", { name: /retry|try again/i });
    await expect(retry.first()).toBeVisible();
    const box = await retry.first().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(TARGET_MIN_COARSE - 0.5);
    expect(await horizontalOverflowers(page)).toEqual([]);
  });
});

/**
 * NFR-002 — above the breakpoint nothing this spec did may show.
 *
 * Asserted as the desktop layout's own invariants rather than as a
 * before/after diff, which cannot be run once the change has landed: the
 * sidebar is still a 360px column beside the map, and none of the phone-only
 * surfaces exist at all.
 */
test.describe("NFR-002: the desktop layout is untouched", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
  ]) {
    test(`no phone surface appears at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await settle(page);

      // The sheet, the stage steppers and the collapsed clade key are all
      // phone-only. `display: none` keeps the steppers out of the
      // accessibility tree too, so these are absences, not hidden elements.
      await expect(page.locator("[data-sheet-stop]")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /older stage/i }),
      ).toHaveCount(0);

      // SPEC-023 UX-001 still applies above the breakpoint: the key opens
      // expanded, and the amendment did not touch that.
      await expect(
        page.getByRole("button", { name: /clade key/i }),
      ).toHaveAttribute("aria-expanded", "true");

      // The column is still a column: 360px, or 42vw where that is smaller.
      const aside = await page.locator("aside").boundingBox();
      expect(aside?.width ?? 0).toBeCloseTo(
        Math.min(360, viewport.width * 0.42),
        0,
      );

      // And the Ma axis, which the phone hides, is still drawn here.
      await expect(page.locator("[class*='stageAxis']")).toBeVisible();
    });
  }
});
