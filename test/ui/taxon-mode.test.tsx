// @vitest-environment jsdom
/**
 * SPEC-010 REQ-004/005 — Taxon mode: one row per taxon; the rank selector rolls
 * genera up into families; selecting a taxon opens its summary panel with the
 * profile action (the map focus/dim is verified separately at the paint level).
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

async function enterTaxonMode() {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const group = within(
    await screen.findByRole("radiogroup", { name: /one row per/i }),
  );
  await user.click(group.getByRole("radio", { name: "Genus" }));
  return user;
}

test("lists one row per genus at the Genus unit", async () => {
  await enterTaxonMode();
  const region = screen.getByRole("region", { name: /genus on the map/i });
  expect(within(region).getByText("Tyrannosaurus")).toBeInTheDocument();
  expect(within(region).getByText("Triceratops")).toBeInTheDocument();
});

test("SPEC-026 REQ-001: choosing Family rolls genera up, in one action", async () => {
  const user = await enterTaxonMode();
  // The rank `<select>` is gone: the tier is one of the five units, so this is
  // a single click rather than a mode plus a dropdown.
  const group = within(
    screen.getByRole("radiogroup", { name: /one row per/i }),
  );
  await user.click(group.getByRole("radio", { name: "Family" }));
  const region = screen.getByRole("region", { name: /family on the map/i });
  expect(within(region).getByText("Tyrannosauridae")).toBeInTheDocument();
  // Genera are now rolled up, so their names no longer head a row.
  expect(within(region).queryByText("Nanotyrannus")).toBeNull();
});

test("SPEC-026 REQ-003: selecting a taxon replaces the list with its detail", async () => {
  const user = await enterTaxonMode();
  const region = screen.getByRole("region", { name: /genus on the map/i });
  await user.click(
    within(region).getByRole("button", { name: /Tyrannosaurus/ }),
  );

  const panel = screen.getByRole("region", { name: /taxon:/i });
  expect(
    within(panel).getByRole("button", { name: /open taxon profile/i }),
  ).toBeInTheDocument();
  // The detail *replaces* the list rather than stacking above it — stacking
  // pushed the list out of a 360px column.
  expect(
    screen.queryByRole("region", { name: /genus on the map/i }),
  ).not.toBeInTheDocument();
  // And the way back names what it returns to, so the cost of leaving is legible.
  const back = within(panel).getByRole("button", {
    name: /back to \d+ genera/i,
  });
  await user.click(back);
  expect(
    screen.getByRole("region", { name: /genus on the map/i }),
  ).toBeInTheDocument();
});
