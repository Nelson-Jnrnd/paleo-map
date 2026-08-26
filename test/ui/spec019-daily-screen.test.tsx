// @vitest-environment jsdom
/**
 * SPEC-019 REQ-004/005/007/008, UX-001/003/004 — the rendered board: the tree
 * is the screen, the guesses are its branches, nothing below the shared clade
 * leaks, no depth or distance is printed, and the reveal carries its source.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderGame } from "./spec019-harness.js";

afterEach(cleanup);

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("REQ-005: a fresh round shows the root and an unresolved descent, nothing else", () => {
  const { container } = renderGame();
  // The trunk is the ordered list; one node on it before any guess.
  expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  expect(screen.getByText("Dinosauria")).toBeTruthy();
  // SPEC-025 REQ-004 (owner, 2026-08-14): the unresolved continuation is
  // removed — for everyone at once, sighted and screen-reader alike — so the
  // diagram simply ends at its last row. A fresh round is a single root row.
  expect(screen.queryByText(/the descent continues/i)).toBeNull();
  expect(screen.queryByText(/unresolved/i)).toBeNull();
  // No other clade is on screen before a guess.
  expect(screen.queryByText("Theropoda")).toBeNull();
  expect(screen.queryByText("Coelurosauria")).toBeNull();
});

test("REQ-004/REQ-005: a guess establishes the trunk and rules out its branch", async () => {
  renderGame();
  await guess("Velociraptor");

  expect(screen.getByText("Theropoda")).toBeTruthy();
  expect(screen.getByText("Coelurosauria")).toBeTruthy();
  // SPEC-025 REQ-003: the eliminated branch is no longer struck through — it is
  // a ringed leaf off the spine, with its name in full.
  const cut = screen.getByText("Maniraptora");
  expect(cut.tagName.toLowerCase()).toBe("span");
  expect(cut.closest("s")).toBeNull();
  // The guess that ruled it out is drawn as its own row inside that branch,
  // rather than as a "◂ name" suffix on it — named once either way.
  expect(screen.queryByText("◂ Velociraptor")).toBeNull();
  expect(screen.getAllByText("Velociraptor")).toHaveLength(1);
  // And it still says, in words, which guess did the ruling out.
  expect(
    screen.getByText(/— ruled out by the guess Velociraptor/i),
  ).toBeTruthy();
});

test("REQ-005: the guesses are the branches — there is no separate guess list", async () => {
  renderGame();
  await guess("Triceratops");
  await guess("Diplodocus");

  expect(screen.getByText("Ornithischia")).toBeTruthy();
  expect(screen.getByText("Saurischia")).toBeTruthy();
  // SPEC-025 REQ-003: each guess appears exactly once on the board, now as a
  // ringed leaf inside the branch it eliminated rather than as a suffix on it.
  // There is still no separate guess list.
  expect(screen.getAllByText("Triceratops")).toHaveLength(1);
  expect(screen.getAllByText("Diplodocus")).toHaveLength(1);
});

test("REQ-005: only branches a guess has touched appear — no siblings", async () => {
  renderGame();
  await guess("Velociraptor");

  for (const untouched of [
    "Ornithischia",
    "Saurischia",
    "Avialae",
    "Nyasasaurus",
  ]) {
    expect(screen.queryByText(untouched)).toBeNull();
  }
});

test("REQ-004: nothing below the deepest shared clade is rendered", async () => {
  renderGame();
  await guess("Gorgosaurus");

  expect(screen.getByText("Tyrannosauridae")).toBeTruthy();
  // The answer and the branch it sits in stay hidden.
  expect(screen.queryByText("Tyrannosaurus")).toBeNull();
  expect(screen.queryByText("Tyrannosaurinae")).toBeNull();
});

test("REQ-004: no depth, distance or percentage is printed anywhere", async () => {
  const { container } = renderGame();
  await guess("Velociraptor");
  const text = container.textContent ?? "";
  expect(text).not.toMatch(/\d+\s*steps?/i);
  expect(text).not.toMatch(/steps? (to go|remaining|away)/i);
  expect(text).not.toMatch(/\d+\s*%/);
  expect(text).not.toMatch(/depth/i);
});

test("REQ-005: the deepest node is the frontier and names the guess that reached it", async () => {
  const { container } = renderGame();
  await guess("Triceratops");
  await guess("Gorgosaurus");

  // SPEC-025 REQ-004: the frontier is a row, not a nested block — it keeps its
  // teal ring, its weight and the visible words "deepest reached".
  const frontier = container.querySelector('[class*="frontier"]');
  expect(frontier).toBeTruthy();
  const node = frontier as HTMLElement;
  expect(within(node).getByText("Tyrannosauridae")).toBeTruthy();
  expect(within(node).getByText(/deepest reached so far/i)).toBeTruthy();
  expect(within(node).getByText(/^deepest reached$/i)).toBeTruthy();

  // REQ-003: the guess that got here is its own ringed row inside the branch it
  // ruled out, one indent further right — no longer a suffix on the node.
  expect(screen.getAllByText("Gorgosaurus")).toHaveLength(1);
  expect(screen.queryByText("◂ Gorgosaurus")).toBeNull();
  expect(
    screen.getByText(/— ruled out by the guess Gorgosaurus/i),
  ).toBeTruthy();
});

test("REQ-007: a correct guess wins, reveals the answer, and offers the taxon page", async () => {
  const { onOpenProfile } = renderGame();
  await guess("Tyrannosaurus");

  expect(screen.getByText(/solved in 1 of 8/i)).toBeTruthy();
  // Twice on purpose: the trunk now descends all the way to the answer, and the
  // reveal names it.
  expect(screen.getAllByText("Tyrannosaurus")).toHaveLength(2);
  expect(screen.getByText(/Dinosauria › Theropoda/)).toBeTruthy();

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /open taxon page/i }));
  expect(onOpenProfile).toHaveBeenCalledWith("t:trex");
});

test("UX-004: the reveal names the reference the accepted name rests on", async () => {
  renderGame();
  await guess("Tyrannosaurus");
  expect(
    screen.getByText(/accepted per Tyrannosaurus Author, 1900/i),
  ).toBeTruthy();
});

test("UX-004: the snapshot date is visible without a hover or a second click", async () => {
  // SPEC-021 UX-005 deleted the screen footer that carried this; REQ-003 moved the
  // date onto the reveal's source line, which is where the game actually asserts a
  // placement (SPEC-019 AMEND-001). So the date is no longer on screen during the
  // round — it arrives with the reveal, unprompted, and is plain text there.
  renderGame();
  expect(screen.queryByText(/sourced opinion/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Per PBDB snapshot/i)).not.toBeInTheDocument();

  await guess("Tyrannosaurus");
  const source = screen.getByText(/PBDB snapshot 2026-07-26/i);
  expect(source).toBeTruthy();
  // Same line still names the authority the placement rests on, and neither half
  // is behind a hover or a second click.
  expect(source.textContent).toMatch(/accepted per|source not available/i);
});

test("REQ-007: eight misses lose the round and still reveal the whole descent", async () => {
  renderGame();
  for (const name of [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
    "Fillerosaurus0",
    "Fillerosaurus1",
    "Fillerosaurus2",
  ]) {
    await guess(name);
  }
  expect(screen.getByText(/not solved · 8 of 8 used/i)).toBeTruthy();
  expect(screen.getByText("Tyrannosaurus")).toBeTruthy();
  expect(
    screen.getByText(
      /Dinosauria › Theropoda › Coelurosauria › Tyrannosauridae/,
    ),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Guess a genus")).toBeNull();
});

test("REQ-008: the hint is locked until the fifth miss, then consumes no guess", async () => {
  renderGame();
  expect(screen.getByText(/silhouette hint — from guess 5/i)).toBeTruthy();

  for (const name of [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
  ]) {
    await guess(name);
  }
  const reveal = screen.getByRole("button", { name: /reveal the silhouette/i });
  await userEvent.setup().click(reveal);

  expect(screen.getByAltText("Silhouette of the hidden genus")).toBeTruthy();
  expect(screen.getByText(/hint used — marked in your result/i)).toBeTruthy();
  expect(screen.getByText("5 of 8 guesses")).toBeTruthy();
});

test("UX-003: each guess result is announced once, in words", async () => {
  const { container } = renderGame();
  await guess("Velociraptor");
  const live = container.querySelectorAll('[aria-live="polite"]');
  const announcements = [...live]
    .map((el) => el.textContent ?? "")
    .filter((t) => t.includes("Velociraptor"));
  expect(announcements).toHaveLength(1);
  expect(announcements[0]).toContain("deepest shared clade Coelurosauria");
  expect(announcements[0]).toContain("Maniraptora is ruled out");
});

test("UX-003: tree state is carried in words, not only by colour", async () => {
  renderGame();
  await guess("Triceratops");
  expect(screen.getAllByText(/established ancestor/i).length).toBeGreaterThan(
    0,
  );
  expect(screen.getByText(/ruled out by the guess Triceratops/i)).toBeTruthy();
});

test("UX-001: the copy uses domain language, not product-speak", () => {
  const { container } = renderGame();
  const text = (container.textContent ?? "").toLowerCase();
  for (const banned of [
    "insights",
    "engagement",
    "activity",
    "points",
    "score",
    "level ",
    "xp",
  ]) {
    expect(text).not.toContain(banned);
  }
  // SPEC-021 UX-006: renamed to plainer domain language.
  expect(text).toContain("taxonomic tree");
  expect(text).not.toContain("established classification");
});

test("NFR-002: the board renders without a linear scan per node", () => {
  const started = performance.now();
  renderGame();
  expect(performance.now() - started).toBeLessThan(2000);
  vi.restoreAllMocks();
});
