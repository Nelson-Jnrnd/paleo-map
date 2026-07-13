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
  // Allow generous headroom: first WebGL paint of the full real dataset is
  // heavier than the fixture (a scale signal, tracked as a follow-up).
  await expect(page.getByText(/Paleogeographic reconstruction/i)).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 20_000 });

  // The basemap attributes its source and confirms the shared reconstruction
  // frame with the occurrences (SPEC-004 REQ-002/003).
  await expect(page.getByText(/GPlates/i)).toBeVisible();
  await expect(page.getByText(/same reconstruction/i)).toBeVisible();
});

test('PERF-340: occurrence → taxon profile → back to map, in a real browser', async ({ page }) => {
  await page.goto('/');

  // Default age (Maastrichtian) is selected and the dinosaurs group is active.
  await expect(page.getByText('Dinosaurs', { exact: true })).toBeVisible();

  // Select the first occurrence from the accessible list (data-agnostic: works
  // against the shipped real PBDB dataset), open its profile, return.
  const list = page.locator('section[aria-label="Visible occurrences"]');
  await list.getByRole('button').first().click();
  await page.getByRole('button', { name: /Open taxon profile/i }).click();

  await expect(page.getByRole('region', { name: /Taxon profile:/i })).toBeVisible();

  await page.getByRole('button', { name: /Back to map/i }).click();
  await expect(page.getByRole('navigation', { name: /timeline/i })).toBeVisible();
});
