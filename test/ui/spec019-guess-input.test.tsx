// @vitest-environment jsdom
/**
 * SPEC-019 REQ-003, UX-002, UX-003 — the guess line: what it accepts, what it
 * refuses and in what words, and that a refusal costs the player nothing.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderGame } from "./spec019-harness.js";

afterEach(cleanup);

async function type(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
}

async function submit(name: string): Promise<void> {
  await type(name);
  await userEvent.setup().click(screen.getByRole("button", { name: /guess/i }));
}

test("REQ-003: a valid non-avian genus is accepted", async () => {
  renderGame();
  await submit("Velociraptor");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
});

test("REQ-003: a clade is refused as not a genus, and names its rank", async () => {
  renderGame();
  await submit("Ornithischia");
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Ornithischia is not a genus");
  expect(alert.textContent).toContain("clade");
  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();
});

test("REQ-003: a junior synonym is refused, naming its recorded status", async () => {
  renderGame();
  await submit("Antrodemus");
  expect(screen.getByRole("alert").textContent).toContain(
    "recorded as Synonymous",
  );
  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();
});

test("REQ-003: a taxon outside Dinosauria is refused as out of scope", async () => {
  renderGame();
  await submit("Smilodon");
  expect(screen.getByRole("alert").textContent).toContain("outside Dinosauria");
});

test("REQ-003: an avian genus is refused, naming the branch", async () => {
  renderGame();
  await submit("Archaeopteryx");
  expect(screen.getByRole("alert").textContent).toContain("avian branch");
});

test("REQ-003: an unknown name is refused without naming a taxon", async () => {
  renderGame();
  await submit("Nothingsaurus");
  expect(screen.getByRole("alert").textContent).toContain(
    "No genus of that name is in this snapshot",
  );
});

test("REQ-003: a repeat is refused and consumes no guess", async () => {
  renderGame();
  await submit("Velociraptor");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  await submit("Velociraptor");
  expect(screen.getByRole("alert").textContent).toContain("already guessed");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
});

test("REQ-003: a refusal leaves the tree untouched", async () => {
  const { container } = renderGame();
  await submit("Velociraptor");
  const before = container.querySelectorAll("ol > li").length;
  await submit("Ornithischia");
  expect(container.querySelectorAll("ol > li")).toHaveLength(before);
});

test("REQ-003: matching is case- and diacritic-insensitive", async () => {
  renderGame();
  await submit("vELOCIRÁPTOR");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
});

test("REQ-003: the autocomplete offers genera and can be chosen by keyboard", async () => {
  const user = userEvent.setup();
  renderGame();
  await type("Veloc");

  const options = screen.getAllByRole("option");
  expect(options.map((o) => o.textContent)).toContain("Velociraptor");

  await user.keyboard("{ArrowDown}");
  await user.click(screen.getByRole("button", { name: /guess/i }));
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
});

test("UX-003: the guess field is a labelled combobox", () => {
  renderGame();
  const input = screen.getByRole("combobox", { name: "Guess a genus" });
  expect(input.getAttribute("aria-autocomplete")).toBe("list");
});

test("REQ-003: the guessable count is stated in domain terms", () => {
  renderGame();
  expect(screen.getByText(/genera only · \d[\d,]* guessable/i)).toBeTruthy();
});
