import { expect, test } from "@playwright/test";

/**
 * SPEC-019 REQ-005/007/012, UX-003 — one full round in a real browser against
 * the shipped snapshot: open at `#daily`, guess, watch the tree grow, lose, and
 * hand off to the taxon page. Plus a keyboard-only round.
 */

const MISSES = [
  "Triceratops",
  "Diplodocus",
  "Velociraptor",
  "Stegosaurus",
  "Allosaurus",
  "Iguanodon",
  "Brachiosaurus",
  "Coelophysis",
];

test("REQ-012: #daily opens the puzzle directly", async ({ page }) => {
  await page.goto("/#daily");
  await expect(page.getByText(/TAXONOMIC TREE/i)).toBeVisible();
  await expect(page.getByText("Dinosauria")).toBeVisible();
  await expect(page.getByText("0 of 8 guesses")).toBeVisible();
});

test("REQ-005/REQ-007: a full round grows the tree and ends with a handoff", async ({
  page,
}) => {
  await page.goto("/#daily");
  await page.getByLabel("Guess a genus").waitFor();

  for (const name of MISSES) {
    if ((await page.getByLabel("Guess a genus").count()) === 0) break;
    await page.getByLabel("Guess a genus").fill(name);
    await page.getByRole("button", { name: /guess/i }).click();
    await page.waitForTimeout(120);
  }

  // Either eight misses or an early win — both end the round with the reveal.
  await expect(
    page.getByRole("button", { name: /open taxon page/i }),
  ).toBeVisible();
  // SPEC-021 REQ-003/UX-005: the screen footer is gone; the snapshot date now
  // rides on the reveal's source line beside the authority (SPEC-019 AMEND-001).
  await expect(page.getByText(/accepted per/i)).toBeVisible();
  await expect(page.getByText(/PBDB snapshot/i)).toBeVisible();
  await expect(page.getByText(/sourced opinion/i)).toHaveCount(0);

  // The reveal hands off to the taxon page, and the app bar carries the way back
  // (SPEC-022 REQ-004) — the screen no longer has a back control of its own. The
  // taxon page is a detail view, not a destination, so no destination is marked
  // current there (REQ-003).
  await page.getByRole("button", { name: /open taxon page/i }).click();
  const bar = page.getByRole("navigation", { name: /main/i });
  await expect(bar.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /back to map/i })).toHaveCount(
    0,
  );
  await expect(bar.locator("[aria-current='page']")).toHaveCount(0);
  await bar.getByRole("button", { name: "Map" }).click();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({
    timeout: 20_000,
  });
});

test("UX-003: a round is playable with the keyboard alone", async ({
  page,
}) => {
  await page.goto("/#daily");
  const input = page.getByLabel("Guess a genus");
  await input.waitFor();
  await input.focus();
  await page.keyboard.type("Triceratops");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("1 of 8 guesses")).toBeVisible();
});

/**
 * SPEC-020 REQ-004/REQ-007 — the track option in a real browser: it is offered,
 * it names what the ranking is, and choosing it changes the puzzle.
 */
test("SPEC-020 REQ-004: the track option offers both puzzles and is honest about the ranking", async ({
  page,
}) => {
  await page.goto("/#daily");
  await page.getByLabel("Guess a genus").waitFor();

  // SPEC-024 REQ-001: two named controls in the header, exposed as a
  // single-choice group, replacing the fieldset of stacked labels.
  const group = page.getByRole("radiogroup", { name: /which puzzle/i });
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio")).toHaveCount(2);

  // SPEC-020 AMEND-006: the caveat moved behind an information control, so what
  // must be on the surface with no interaction is the *control*. The caveat
  // itself is one deliberate, keyboard-reachable action away — never a hover,
  // never a `title`.
  const caveat = /attention, not of scientific importance/i;
  const about = page.getByRole("button", {
    name: /about the .well-known. ranking/i,
  });
  await expect(about).toBeVisible();
  await expect(about).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(caveat)).toHaveCount(0);

  // REQ-003: the selected track's pool size is still visible without interaction.
  await expect(page.getByText(/genera in the snapshot/i)).toBeVisible();

  // Opening it discloses the wording UX-001 and UX-002 require, unchanged.
  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/English Wikipedia/i).first()).toBeVisible();
  await expect(page.getByText(caveat)).toBeVisible();

  await group.getByRole("radio", { name: /well-known/i }).click();
  await expect(
    group.getByRole("radio", { name: /well-known/i }),
  ).toHaveAttribute("aria-checked", "true");
  // The control is rendered on the other track too, so the caveat stays
  // reachable in every state the option is rendered in; the detail follows the
  // selection.
  await expect(about).toBeVisible();
  await expect(page.getByText(/most read about/i)).toBeVisible();
});

test("SPEC-020 REQ-007: #daily-known opens the well-known track directly", async ({
  page,
}) => {
  await page.goto("/#daily-known");
  await page.getByLabel("Guess a genus").waitFor();
  await expect(page.getByRole("radio", { name: /well-known/i })).toBeChecked();
});
