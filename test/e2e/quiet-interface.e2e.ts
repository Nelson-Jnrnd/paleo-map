import { expect, test } from "@playwright/test";
import {
  openControlsDrawer,
  settle,
  horizontalOverflowers,
  smallTargets,
  TARGET_MIN_COARSE,
} from "./phone-viewports.js";

for (const phone of [false, true]) {
  test.describe(
    phone ? "quiet interface on phone" : "quiet interface on desktop",
    () => {
      test.use({
        viewport: phone
          ? { width: 390, height: 664 }
          : { width: 1440, height: 900 },
        hasTouch: phone,
        isMobile: phone,
      });
      test("sources stay behind disclosures and reading returns to the map selection", async ({
        page,
      }) => {
        await page.goto("/");
        await settle(page);
        if (phone)
          await page
            .getByRole("button", { name: /activate to resize/i })
            .click();
        else {
          await expect(page.locator("aside")).toHaveCount(0);
          await page.getByRole("button", { name: "Browse dinosaurs" }).click();
        }
        await page.locator("button[data-unit-row]").first().click();
        const panel = page.getByRole("region", { name: /^Taxon:/ });
        await expect(panel).toBeVisible();
        const heading = await panel.getByRole("heading").first().innerText();
        const evidence = panel.locator("details").first();
        await expect(evidence).not.toHaveAttribute("open", "");
        await evidence.locator("summary").first().click();
        await evidence.locator("details summary").first().click();
        await expect(
          evidence.getByText("Record", { exact: true }).first(),
        ).toBeVisible();
        expect(await horizontalOverflowers(page)).toEqual([]);
        if (phone)
          expect(
            await smallTargets(page, TARGET_MIN_COARSE, ["[data-stage-step]"]),
          ).toEqual([]);
        await panel
          .getByRole("button", { name: "Read about this dinosaur" })
          .click();
        await expect(
          page.getByRole("link", { name: "Open on Wikipedia" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Back to map" }).click();
        await expect(
          page
            .getByRole("region", { name: /^Taxon:/ })
            .getByRole("heading")
            .first(),
        ).toHaveText(heading);
        await settle(page);
        if (process.env["PALEO_QA_SHOTS"])
          await page.screenshot({
            path: `${process.env["PALEO_QA_SHOTS"]}/${phone ? "phone" : "desktop"}-selection.png`,
          });
      });
      test("entry is quiet and the canvas fits the available pane", async ({
        page,
      }) => {
        await page.goto("/");
        await settle(page);
        if (process.env["PALEO_QA_SHOTS"])
          await page.screenshot({
            path: `${process.env["PALEO_QA_SHOTS"]}/${phone ? "phone" : "desktop"}-entry.png`,
          });
        if (phone) await openControlsDrawer(page);
        else
          await page.getByRole("button", { name: "Browse dinosaurs" }).click();
        if (!phone) {
          await expect
            .poll(async () =>
              page
                .locator("canvas.maplibregl-canvas")
                .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
            )
            .toBe(
              Math.round(
                (await page.locator("[data-map-pane]").boundingBox())!.width,
              ),
            );
          await page.getByRole("button", { name: "Close" }).click();
          await expect
            .poll(async () =>
              page
                .locator("canvas.maplibregl-canvas")
                .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
            )
            .toBe(
              Math.round(
                (await page.locator("[data-map-pane]").boundingBox())!.width,
              ),
            );
        }
        await expect(page.getByRole("checkbox")).toHaveCount(0);
        const data = page
          .locator("details")
          .filter({ has: page.getByText("About data", { exact: true }) });
        await data.locator("summary").click();
        await expect(data.getByText(/Paleobiology Database/)).toBeVisible();
      });
    },
  );
}

test.describe("quiet interface keyboard recovery", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("closing the directory restores focus and empty stages keep truthful recovery controls", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    const browse = page.getByRole("button", { name: "Browse dinosaurs" });
    await browse.click();
    await page.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(browse).toBeFocused();
    await page.getByRole("button", { name: /^Induan,/ }).click();
    await expect(page.locator("aside")).toBeVisible();
    await expect(browse).toBeDisabled();
    await expect(browse).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Reset view" })
      .click();
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(browse).toBeEnabled();
    await expect(browse).toHaveAttribute("aria-expanded", "false");
  });
});
