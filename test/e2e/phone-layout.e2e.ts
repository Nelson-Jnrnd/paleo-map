import { expect, test } from "@playwright/test";
import {
  PHONE_VIEWPORTS,
  TARGET_MIN_COARSE,
  horizontalOverflowers,
  settle,
  smallTargets,
  textInputFontSizes,
} from "./phone-viewports.js";

/**
 * SPEC-030 NFR-001 — the phone regression gate.
 *
 * The defect this exists to catch: nothing in the project was tested below
 * 820px, which is exactly why SPEC-023's overlap defect (P-10) shipped *inside*
 * a spec that has an automated non-overlap gate. A layout that is only ever
 * looked at on a desktop regresses silently on a phone.
 *
 * Every assertion here enumerates elements rather than naming them, so a
 * control added later is covered without anyone remembering to add it.
 *
 * Covers REQ-002 (no horizontal overflow), REQ-005 (age/group/count permanent),
 * UX-001 (44px targets on coarse pointers) and UX-003 (16px inputs).
 */

/** The screens reachable from the app bar, plus the map the app boots into. */
const SCREENS = ["Map", "Dinordle", "Taxonomy"] as const;

/**
 * REQ-006 exempts the to-scale stage steps by ID, not by accident: 30 stages ×
 * 44px is 1,320px, which no phone has. Precise stage selection is served by the
 * discrete previous/next controls, which are *not* exempt and are asserted below.
 */
const TARGET_EXEMPT = ["[data-stage-step]"];

for (const viewport of PHONE_VIEWPORTS) {
  const at = `${viewport.width}×${viewport.height}`;

  test(`REQ-002: no horizontal overflow on any screen at ${at}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settle(page);

    for (const screen of SCREENS) {
      if (screen !== "Map") {
        await page.getByRole("button", { name: screen, exact: true }).click();
        await page.waitForTimeout(800);
      }

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        metrics.scrollWidth,
        `${screen} scrolls horizontally at ${at}`,
      ).toBeLessThanOrEqual(metrics.clientWidth);

      const escaped = await horizontalOverflowers(page);
      expect(
        escaped,
        `${screen} has elements outside the viewport at ${at}`,
      ).toEqual([]);
    }
  });

  test(`UX-001: every target meets the coarse-pointer floor at ${at}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settle(page);

    for (const screen of SCREENS) {
      if (screen !== "Map") {
        await page.getByRole("button", { name: screen, exact: true }).click();
        await page.waitForTimeout(800);
      }
      const small = await smallTargets(page, TARGET_MIN_COARSE, TARGET_EXEMPT);
      expect(small, `${screen} has sub-44px targets at ${at}`).toEqual([]);
    }
  });

  test(`UX-003: no text input can trigger iOS auto-zoom at ${at}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settle(page);

    const inputs = await textInputFontSizes(page);
    expect(inputs.length, "expected at least the taxon search").toBeGreaterThan(
      0,
    );
    for (const input of inputs) {
      expect(
        input.fontSize,
        `${input.cls} is ${input.fontSize}px — Safari zooms under 16px`,
      ).toBeGreaterThanOrEqual(16);
    }
  });

  test(`REQ-005: age, group and count stay visible at ${at}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settle(page);

    // FONC-040/050/060 and CONS-450 are MVP requirements and are not relaxed by
    // a narrow viewport. Asserted as *visible in the viewport*, not merely
    // present — an off-screen control is not permanently displayed.
    for (const label of [/Maastrichtian/, /Dinosaur/i]) {
      await expect(page.getByText(label).first()).toBeInViewport();
    }
    await expect(page.locator("[data-occurrence-count]")).toBeInViewport();
  });
}

test("REQ-006: the timeline offers discrete, thumb-sized stage stepping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  await settle(page);

  const older = page.getByRole("button", { name: /older stage/i });
  const younger = page.getByRole("button", { name: /younger stage/i });
  await expect(older).toBeVisible();
  await expect(younger).toBeVisible();

  for (const control of [older, younger]) {
    const box = await control.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(TARGET_MIN_COARSE - 0.5);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(TARGET_MIN_COARSE - 0.5);
  }

  // The app boots at the Maastrichtian, the youngest Mesozoic stage — so the
  // younger control is disabled with a reason rather than hidden (charter §7).
  await expect(younger).toBeDisabled();

  // One tap steps exactly one ICS stage.
  await older.click();
  await expect(page.getByText(/Campanian/).first()).toBeVisible();
});

test("REQ-007: map overlays stay bounded and the clade key opens collapsed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await settle(page);

  // SPEC-023 AMEND-001: collapsed by default below the breakpoint, but still
  // naming itself and still one tap from expanded.
  const toggle = page.getByRole("button", { name: /clade key/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  // Expanded, it must still honour its rail's width bound (REQ-007 clause 1) —
  // the defect that produced P-10's overlap.
  const bounded = await page.evaluate(() => {
    const key = document.querySelector("[data-map-overlay='clade-key']");
    if (!key) return null;
    const rail = key.closest("[data-map-rail]");
    if (!rail) return null;
    return {
      key: key.getBoundingClientRect().width,
      max: parseFloat(getComputedStyle(rail).maxWidth),
    };
  });
  expect(bounded).not.toBeNull();
  expect(bounded!.key).toBeLessThanOrEqual(bounded!.max + 0.5);
});
