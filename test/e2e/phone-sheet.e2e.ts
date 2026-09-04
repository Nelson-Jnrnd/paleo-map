import { expect, test } from "@playwright/test";
import { openControlsDrawer, settle } from "./phone-viewports.js";

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

    const handle = page.getByRole("button", { name: /activate to resize/i });
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
    // Polled rather than read once: the settle is a 160ms height transition, so
    // a single read lands mid-animation and compares against a height the sheet
    // is still travelling through.
    await handle.click();
    await expect(sheet).toHaveAttribute("data-sheet-stop", "peek");
    await expect
      .poll(async () => Math.round((await geometry()).sheet))
      .toBe(Math.round(atPeek.sheet));
  });

  test("REQ-003: the handle is operable from the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const sheet = page.locator("[data-sheet-stop]");
    const handle = page.getByRole("button", { name: /activate to resize/i });
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

    const handle = page.getByRole("button", { name: /activate to resize/i });
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
    const handle = page.getByRole("button", { name: /activate to resize/i });
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

  test("REQ-005 (amended): the map is the majority of the whole screen at rest", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    // The point of the 2026-09-03 amendment. Before it the map was 187px of a
    // 664px screen — 28% — with 205px of permanent header above it and a 152px
    // sheet below. The owner's verdict was that the map has to be the star, so
    // this is measured against the *viewport*, not against the body: chrome
    // that moved into a drawer is chrome that stopped counting.
    const share = await page.evaluate(() => {
      const pane = document.querySelector("[data-map-pane]");
      const sheet = document.querySelector("[data-sheet-stop]");
      if (!pane || !sheet) throw new Error("map screen not mounted");
      const p = pane.getBoundingClientRect();
      const s = sheet.getBoundingClientRect();
      return (s.top - p.top) / window.innerHeight;
    });
    expect(share).toBeGreaterThanOrEqual(0.6);
  });

  test("the sheet says what it holds while it is resting", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    // The regression this exists for: the peek stop rendered a 76px bar with a
    // grab handle and nothing else, because the count sat in the scrollable
    // body below the fold. The sheet at rest has to name itself, and a height
    // assertion cannot tell you whether it does.
    const sheet = page.locator("[data-sheet-stop]");
    await expect(sheet).toHaveAttribute("data-sheet-stop", "peek");

    const handle = sheet.locator("button").first();
    await expect(handle).toBeInViewport();
    await expect(handle).toContainText(/\d+\s+occurrences?/);
  });

  test("a detail opens at its own top, with the way back on screen", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const row = page.locator("button[data-unit-row]").first();
    await row.waitFor();
    await row.click();

    // The regression: the sheet body kept the list's scroll offset, so a tap on
    // a row landed the reader halfway down the detail with the taxon's name and
    // the back control above the fold. `toBeVisible()` passes for an element
    // scrolled out of a scroll container — only `toBeInViewport()` catches it,
    // which is why the existing REQ-004 test did not.
    const back = page.getByRole("button", {
      name: /back to .*(occurrence|genera|localities|families|groups)/i,
    });
    await expect(back).toBeInViewport();

    // And the list's own controls stand down (SPEC-026 AMEND-002): in a 290px
    // sheet they cost the detail most of its room.
    await expect(
      page.getByRole("radiogroup", { name: /one row per/i }),
    ).toHaveCount(0);
  });

  test("an age with no occurrences offers its way out without a gesture", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    const older = page.getByRole("button", { name: /older stage/i });
    for (let i = 0; i < 34 && (await older.isEnabled()); i++) {
      await older.click();
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1500);

    // FONC-1280 and charter §7: the empty state carries a recovery path, and at
    // a 76px resting height it sat below the fold — the screen was a blank map
    // and a count of zero. The sheet raises itself instead.
    await expect(
      page.getByText(/no occurrences at this age/i),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: /reset view/i }).last(),
    ).toBeInViewport();
  });

  test("the in-view count is stated once, not twice", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: /activate to resize/i }).click();
    await page.waitForTimeout(500);

    // The handle carries the count at every stop, so the list's own header
    // repeated it three lines below.
    const sheetText = await page.locator("[data-sheet-stop]").innerText();
    const counts = sheetText.match(/\d+\s+occurrences?\b/gi) ?? [];
    expect(counts.length).toBeLessThanOrEqual(1);
  });

  test("REQ-008 (amended): the map opens framed on the data, not on a fixed camera", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    await page.waitForTimeout(1200);

    // The map used to open at a `center`/`zoom` chosen for a wide desktop pane;
    // on a portrait phone that crop put the markers against the left edge and
    // filled the right half with empty ocean. Asserted through what the app
    // itself reports rather than by reading the camera: the strip names the
    // total at this age, the sheet names how many of them are on screen.
    const total = Number(
      (await page.locator("[data-occurrence-count]").innerText()).replace(
        /\D/g,
        "",
      ),
    );
    const inView = Number(
      (
        (await page.locator("[data-sheet-stop] button").first().innerText()) ??
        ""
      ).replace(/\D/g, ""),
    );
    expect(total).toBeGreaterThan(0);
    expect(inView / total).toBeGreaterThanOrEqual(0.5);
  });

  test("REQ-005 (amended): the drawer is shut on load and opens on request", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    // Closed means *not rendered*, not merely hidden: the search field is the
    // tell, since UX-003's gate has to be able to find it once opened. Scoped
    // to text fields — the Wikipedia-gate checkbox lives in the sheet and is
    // on screen throughout (SPEC-023 AMEND-003).
    const searchField = page.locator(
      "input[type='search'], input[type='text'], input:not([type])",
    );
    await expect(searchField).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: /age, search and map controls/i }),
    ).toHaveCount(0);

    await openControlsDrawer(page);
    await expect(
      page.getByRole("group", { name: /age, search and map controls/i }),
    ).toBeVisible();
    await expect(searchField.first()).toBeVisible();

    // The to-scale timeline SPEC-009 REQ-001 requires is in here, whole.
    await expect(
      page.getByRole("group", { name: /jump to period/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();
    await expect(searchField).toHaveCount(0);
  });

  test("SPEC-009 AMEND-003: the drawer's track shows one period at a time", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    await openControlsDrawer(page);

    // The defect: the full Mesozoic window puts ~30 stages across the drawer's
    // 366px track, so the narrowest step is 1-2px. Asserted through the steps
    // themselves rather than through a width, because "readable" is a property
    // of how many stages share the track, not of any one measurement.
    const steps = page.locator("[data-stage-step]");
    const atCretaceous = await steps.count();
    expect(atCretaceous).toBeGreaterThan(0);
    expect(atCretaceous).toBeLessThanOrEqual(15);

    // Every step is wide enough to see and to aim at.
    const narrowest = await page.evaluate(() =>
      Math.min(
        ...Array.from(document.querySelectorAll("[data-stage-step]")).map(
          (el) => el.getBoundingClientRect().width,
        ),
      ),
    );
    expect(narrowest).toBeGreaterThanOrEqual(8);

    // The three bands became a stepper, and it re-scopes the track: the group
    // REQ-002's jump affordance lives in keeps its role and name.
    const jump = page.getByRole("group", { name: /jump to period/i });
    await expect(jump).toBeVisible();
    await expect(jump).toContainText(/Cretaceous/);

    await jump.getByRole("button", { name: /older period/i }).click();
    await page.waitForTimeout(300);
    await expect(jump).toContainText(/Jurassic/);
    // Scoped, not merely relabelled: a Jurassic stage is on the track and the
    // Cretaceous stages have left it.
    // Matched on the step's accessible name: the steps are bars, not labels —
    // the stage name is their `aria-label`, not their text.
    await expect(
      page.locator('[data-stage-step][aria-label^="Kimmeridgian,"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-stage-step][aria-label^="Maastrichtian,"]'),
    ).toHaveCount(0);
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
