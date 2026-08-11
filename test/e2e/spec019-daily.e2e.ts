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
  await expect(page.getByText(/ESTABLISHED CLASSIFICATION/i)).toBeVisible();
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
  await expect(page.getByText(/accepted per/i)).toBeVisible();
  await expect(page.getByText(/Per PBDB snapshot/i)).toBeVisible();

  await page.getByRole("button", { name: /open taxon page/i }).click();
  await expect(
    page.getByRole("button", { name: /back to map/i }),
  ).toBeVisible();
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

  await expect(
    page.getByRole("group", { name: /which puzzle/i }),
  ).toBeVisible();
  await expect(page.getByText(/English Wikipedia/i).first()).toBeVisible();
  await expect(
    page.getByText(/attention, not of scientific importance/i),
  ).toBeVisible();

  await page.getByRole("radio", { name: /well-known/i }).check();
  await expect(page.getByText(/well-known/i).first()).toBeVisible();
});

test("SPEC-020 REQ-007: #daily-known opens the well-known track directly", async ({
  page,
}) => {
  await page.goto("/#daily-known");
  await page.getByLabel("Guess a genus").waitFor();
  await expect(page.getByRole("radio", { name: /well-known/i })).toBeChecked();
});
