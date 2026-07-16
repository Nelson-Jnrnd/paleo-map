import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility gate (SPEC-002 NFR-002). Runs axe on the two key
 * screens — the exploration view and a taxon profile — and fails on any
 * serious/critical WCAG 2 A/AA violation. Complements the jsx-a11y lint intent;
 * this is the runtime check the design charter's keyboard/contrast rules need.
 */

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function seriousViolations(builder: AxeBuilder): Promise<string[]> {
  const results = await builder.withTags(RULES).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s)`);
}

test("exploration view has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: /timeline/i }).waitFor();
  // Exclude the MapLibre canvas: WebGL map internals are not axe-testable and the
  // accessible occurrence list is the equivalent path (charter / SPEC-002 a11y).
  const violations = await seriousViolations(
    new AxeBuilder({ page }).exclude(".maplibregl-map"),
  );
  expect(violations, violations.join("\n")).toEqual([]);
});

test("taxon profile has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const list = page.locator('section[aria-label="Visible occurrences"]');
  await list.locator('button[aria-expanded="false"]').first().click();
  await list.locator('ul[id^="group-"] button').first().click();
  await page.getByRole("button", { name: /Open taxon profile/i }).click();
  await page.getByRole("region", { name: /Taxon profile:/i }).waitFor();

  const violations = await seriousViolations(new AxeBuilder({ page }));
  expect(violations, violations.join("\n")).toEqual([]);
});
