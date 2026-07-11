import { expect, test } from '@playwright/test';

/**
 * Real-browser E2E over the built static app (SPEC-002 REQ-008; SPEC-003
 * REQ-002/007). Confirms the exploration view boots from the static bundle,
 * the MapLibre canvas renders (REQ-002), and the PERF-340 loop completes.
 */

test('boots from the static bundle and renders the paleogeographic map', async ({ page }) => {
  await page.goto('/');

  // First useful content: the exploration timeline.
  await expect(page.getByRole('navigation', { name: /timeline/i })).toBeVisible();

  // The map is labeled a reconstruction (FONC-300) and MapLibre renders a canvas.
  await expect(page.getByText(/Paleogeographic reconstruction/i)).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
});

test('PERF-340: occurrence → taxon profile → back to map, in a real browser', async ({ page }) => {
  await page.goto('/');

  // Default age (Maastrichtian) is selected and the dinosaurs group is active.
  await expect(page.getByText('Dinosaurs', { exact: true })).toBeVisible();

  // Select an occurrence from the accessible list, open its profile, return.
  await page.getByRole('button', { name: /Tyrannosaurus/ }).first().click();
  await page.getByRole('button', { name: /Open taxon profile/i }).click();

  await expect(
    page.getByRole('region', { name: /Taxon profile: Tyrannosaurus/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Back to map/i }).click();
  await expect(page.getByRole('navigation', { name: /timeline/i })).toBeVisible();
});
