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

/**
 * SPEC-017 NFR-003. Unlike the taxon profile, the taxonomy screen *is* drivable
 * headlessly — it is one button away in the context bar — so its axe pass is
 * gated here rather than left to the component tests. Without this the gate
 * never saw the screen at all.
 */
test("taxonomy screen has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: /timeline/i }).waitFor();
  await page.getByRole("button", { name: "Taxonomy", exact: true }).click();
  await page.getByRole("region", { name: /shape of dinosauria/i }).waitFor();

  const violations = await seriousViolations(new AxeBuilder({ page }));
  expect(violations, violations.join("\n")).toEqual([]);
});

/**
 * SPEC-019 UX-003. The puzzle is a whole screen of its own and is reachable
 * headlessly from the context bar, so its axe pass is gated here — and it is
 * checked mid-round, because most of the board (the established trunk, the
 * ruled-out branches, the stratigraphic column) only exists after a guess.
 */
test("daily genus screen has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: /timeline/i }).waitFor();
  await page.getByRole("button", { name: "Daily Genus", exact: true }).click();
  await page.getByLabel("Guess a genus").waitFor();

  await page.getByLabel("Guess a genus").fill("Triceratops");
  await page.getByRole("button", { name: /guess/i }).click();
  await page.getByText("1 of 8 guesses").waitFor();

  const violations = await seriousViolations(new AxeBuilder({ page }));
  expect(violations, violations.join("\n")).toEqual([]);
});

/**
 * SPEC-020 UX-004. The second track is a different pool behind the same screen,
 * but it adds the track option — the one piece of new chrome — so it is gated
 * too, at its own address.
 */
test("daily genus well-known track has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/#daily-known");
  await page.getByLabel("Guess a genus").waitFor();

  const violations = await seriousViolations(new AxeBuilder({ page }));
  expect(violations, violations.join("\n")).toEqual([]);
});
