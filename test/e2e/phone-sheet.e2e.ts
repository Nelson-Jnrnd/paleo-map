import { expect, test } from "@playwright/test";
import { settle } from "./phone-viewports.js";

/**
 * SPEC-030 REQ-003 / REQ-004 — the occurrence sheet.
 *
 * The sheet is the phone form of SPEC-026's sidebar column, so the point of
 * this suite is as much what *stayed the same* as what moved: choosing a unit,
 * opening a detail, getting back, and the two-way map↔list highlight all have
 * to behave exactly as they do beside a desktop map (SPEC-026 AMEND-001 records
 * that the amendment is vocabulary, not behaviour).
 */

test.describe("the occurrence sheet at 390×664", () => {
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
  });

  test("REQ-003: the map keeps its share of the screen at every stop", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const sheet = page.locator("[data-sheet-stop]");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-sheet-stop", "peek");

    const geometry = async (): Promise<{ body: number; sheet: number }> =>
      page.evaluate(() => {
        const s = document.querySelector("[data-sheet-stop]");
        const body = s?.parentElement;
        if (!s || !body) throw new Error("sheet not mounted");
        return {
          body: body.getBoundingClientRect().height,
          sheet: s.getBoundingClientRect().height,
        };
      });

    // Criterion 1: resting, the map is still the majority of the screen.
    const atPeek = await geometry();
    expect((atPeek.body - atPeek.sheet) / atPeek.body).toBeGreaterThanOrEqual(
      0.55,
    );

    const handle = page.getByRole("button", { name: /occurrence list/i });
    await handle.click();
    await expect(sheet).toHaveAttribute("data-sheet-stop", "half");
    await handle.click();
    await expect(sheet).toHaveAttribute("data-sheet-stop", "full");

    // Criterion 2: even at full, the map is never entirely covered.
    const atFull = await geometry();
    expect((atFull.body - atFull.sheet) / atFull.body).toBeGreaterThanOrEqual(
      0.25,
    );

    // Criterion 3: the cycle wraps, and returns to the geometry it started at.
    await handle.click();
    await expect(sheet).toHaveAttribute("data-sheet-stop", "peek");
    const back = await geometry();
    expect(back.sheet).toBeCloseTo(atPeek.sheet, 0);
  });

  test("REQ-003: the handle is operable from the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const sheet = page.locator("[data-sheet-stop]");
    const handle = page.getByRole("button", { name: /occurrence list/i });
    await handle.focus();
    await expect(handle).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(sheet).toHaveAttribute("data-sheet-stop", "half");
    await page.keyboard.press("Space");
    await expect(sheet).toHaveAttribute("data-sheet-stop", "full");
  });

  test("REQ-003: the sheet is not a modal — the map behind stays reachable", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const handle = page.getByRole("button", { name: /occurrence list/i });
    await handle.click(); // half

    // Nothing behind the sheet is inert or aria-hidden: a reader panning the
    // map with the list open is the normal case, not an edge one.
    const trapped = await page.evaluate(() => {
      const pane = document.querySelector("[data-map-pane]");
      return {
        inert: pane?.hasAttribute("inert") ?? true,
        hidden: pane?.getAttribute("aria-hidden"),
      };
    });
    expect(trapped.inert).toBe(false);
    expect(trapped.hidden).toBeNull();

    // MapLibre's own zoom control is still hittable above the sheet.
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toBeVisible();
  });

  test("REQ-004: the unit selector, detail and back path all survive the move", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const sheet = page.locator("[data-sheet-stop]");
    const handle = page.getByRole("button", { name: /occurrence list/i });
    await handle.click(); // half, so the list has room

    // SPEC-026 REQ-001: the five-unit selector is present and operable.
    const units = page.getByRole("radiogroup", { name: /one row per/i });
    await expect(units).toBeVisible();
    await units.getByRole("radio", { name: "Genus" }).click();
    await expect(units.getByRole("radio", { name: "Genus" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // SPEC-026 REQ-003: activating a row replaces the list with the detail in
    // the same container, and the back control names the list it returns to.
    const firstRow = sheet.locator("button[data-unit-row]").first();
    await firstRow.waitFor();
    await firstRow.click();

    const back = page.getByRole("button", { name: /back to .* genera/i });
    await expect(back).toBeVisible();
    await expect(sheet.locator("button[data-unit-row]")).toHaveCount(0);

    await back.click();
    await expect(sheet.locator("button[data-unit-row]").first()).toBeVisible();
  });

  test("REQ-004: a detail opened while peeking raises the sheet", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const sheet = page.locator("[data-sheet-stop]");
    await expect(sheet).toHaveAttribute("data-sheet-stop", "peek");

    // Reach a row without changing the stop first: the list is scrollable
    // inside the peeking sheet, so the row is there to be tapped.
    const firstRow = sheet.locator("button[data-unit-row]").first();
    await firstRow.waitFor();
    await firstRow.click();

    // Opening a detail into a 152px slot would bury what was just tapped.
    await expect(sheet).toHaveAttribute("data-sheet-stop", "half");
  });
});
