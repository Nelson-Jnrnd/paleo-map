import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility gate (SPEC-002 NFR-002). Runs axe on the exploration
 * view and fails on any serious/critical WCAG 2 A/AA violation. Complements the
 * jsx-a11y lint intent; this is the runtime check the design charter's
 * keyboard/contrast rules need. SPEC-007 removed the occurrence list, so the
 * taxon profile is reached only via a map-canvas selection (not headlessly
 * drivable) and its axe pass is no longer gated here.
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
  // Exclude the MapLibre canvas: WebGL map internals are not axe-testable.
  const violations = await seriousViolations(
    new AxeBuilder({ page }).exclude(".maplibregl-map"),
  );
  expect(violations, violations.join("\n")).toEqual([]);
});
