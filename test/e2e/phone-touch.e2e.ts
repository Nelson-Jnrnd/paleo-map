import { expect, test } from "@playwright/test";
import { openControlsDrawer, settle } from "./phone-viewports.js";

/**
 * SPEC-030 UX-002 — nothing depends on hover where there is no hover.
 *
 * These are not polish. On touch, "hover" is not a secondary interaction, it is
 * *no* interaction, so CONS-490 ("must not hide uncertainty information behind a
 * secondary interaction") and the charter's §2 north star are both broken by a
 * hover-gated disclosure. SPEC-023 AMEND-001 also depends on the first of these:
 * the clade key may open collapsed on a phone only because the marker card still
 * carries the clade name.
 *
 * The image credit's rule is verified by source inspection in
 * `test/ui/spec030-hover-free.test.ts` rather than here — see that file for why
 * an end-to-end check is not currently possible.
 */

test.describe("touch equivalents at 390×664", () => {
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
  });

  test("UX-002: tapping a marker shows the card SPEC-015 REQ-003 promises", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);

    // The dataset's positions are not fixed by this spec, so the test hunts for
    // a feature rather than assuming where one lands. Either card counts: a tap
    // on a single marker opens the preview card (SPEC-015 REQ-003), a tap on a
    // cluster opens the aggregate card (SPEC-027 REQ-005). Both answer "what is
    // this" before any navigation, which is the guarantee UX-002 restores.
    // Land on one taxon first. At the default age the map holds 2,135
    // occurrences, so a blind tap almost always lands on a cluster big enough
    // that the app zooms in rather than carding it — the test would be hunting
    // a moving target. A search landing frames a handful of points instead.
    await openControlsDrawer(page);
    await page.locator("input[type='search'], input").first().fill("Tyranno");
    await page.waitForTimeout(700);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas.maplibregl-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("map not painted");

    const card = page.locator("[data-map-card]");
    const fractions = [0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75];
    outer: for (const dy of fractions) {
      for (const dx of fractions) {
        await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy);
        await page.waitForTimeout(220);
        if (await card.count()) break outer;
      }
    }

    await expect(card.first()).toBeVisible();
    // The clade name is the piece SPEC-023 AMEND-001 leans on.
    await expect(card.first()).not.toBeEmpty();
  });

  test("UX-002: fan rows carry an affordance with no pointer over them", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: "Taxonomy", exact: true }).click();
    await page.waitForTimeout(1200);

    const details = page.locator("details", {
      hasText: /branches, as a list/i,
    });
    if ((await details.count()) === 0) {
      test.skip(true, "no fan on this taxon");
    }
    await details.first().locator("summary").click();
    const row = page.locator("[class*='fanListItem']").first();
    await expect(row).toHaveCSS("text-decoration-line", "underline");
  });
});
