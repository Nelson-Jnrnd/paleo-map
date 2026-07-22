import { expect, test } from "@playwright/test";

/**
 * Real-browser E2E over the built static app (SPEC-002 REQ-008; SPEC-003 REQ-002).
 * Confirms the exploration view boots from the static bundle and the MapLibre
 * canvas renders (REQ-002). SPEC-009 brought back a viewport-linked occurrence list
 * in the sidebar; the panel→profile→back loop is covered by component tests.
 */

test("boots from the static bundle and renders the paleogeographic map", async ({
  page,
}) => {
  await page.goto("/");

  // First useful content: the exploration timeline.
  await expect(
    page.getByRole("navigation", { name: /timeline/i }),
  ).toBeVisible();

  // The map is labeled a reconstruction (FONC-300) and MapLibre renders a canvas.
  // Allow generous headroom: first WebGL paint of the full real dataset is
  // heavier than the fixture (a scale signal, tracked as a follow-up).
  await expect(page.getByText(/Paleogeographic reconstruction/i)).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 20_000,
  });

  // The basemap attributes its source and confirms the shared reconstruction
  // frame with the occurrences (SPEC-004 REQ-002/003).
  await expect(page.getByText(/GPlates/i)).toBeVisible();
  await expect(page.getByText(/same reconstruction/i)).toBeVisible();

  // The dinosaurs group is active by default, and the sidebar's on-screen
  // occurrence list is present (SPEC-009 REQ-003).
  await expect(page.getByText("Dinosaurs", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: /occurrence details/i }),
  ).toBeVisible();
});
