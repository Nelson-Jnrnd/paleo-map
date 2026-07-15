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

  // Expand the first (most abundant) taxon group, select its first occurrence,
  // open the profile, return (data-agnostic against the real PBDB dataset).
  const list = page.locator('section[aria-label="Visible occurrences"]');
  await list.locator('button[aria-expanded="false"]').first().click();
  await list.locator('ul[id^="group-"] button').first().click();
  await page.getByRole('button', { name: /Open taxon profile/i }).click();

  await expect(page.getByRole('region', { name: /Taxon profile:/i })).toBeVisible();

  await page.getByRole('button', { name: /Back to map/i }).click();
  await expect(page.getByRole('navigation', { name: /timeline/i })).toBeVisible();
});

test('SPEC-005: the list is viewport-linked — zooming in narrows what it shows', async ({
  page,
}) => {
  await page.goto('/');
  const list = page.locator('section[aria-label="Visible occurrences"]');
  const header = list.locator('p').first();
  await expect(header).toContainText(/in view/i);

  const countIn = async (): Promise<number> => {
    const t = (await header.textContent()) ?? '';
    return Number(/·\s*(\d+)\s*occurrences/.exec(t)?.[1] ?? '0');
  };
  const before = await countIn();

  // Zoom into North America (the map is centred there); other continents drop out.
  for (let i = 0; i < 4; i++) {
    await page.locator('.maplibregl-ctrl-zoom-in').click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  const after = await countIn();

  expect(before).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
});
