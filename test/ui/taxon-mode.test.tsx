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
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );
  await user.click(group.getByRole("button", { name: "Taxa" }));
  return user;
}

test("lists one row per genus at the default (genus) tier", async () => {
  await enterTaxonMode();
  const region = screen.getByRole("region", { name: /taxa on the map/i });
  expect(within(region).getByText("Tyrannosaurus")).toBeInTheDocument();
  expect(within(region).getByText("Triceratops")).toBeInTheDocument();
});

test("the rank selector rolls genera up into their family", async () => {
  const user = await enterTaxonMode();
  await user.selectOptions(
    screen.getByRole("combobox", { name: /group by rank/i }),
    "family",
  );
  const region = screen.getByRole("region", { name: /taxa on the map/i });
  expect(within(region).getByText("Tyrannosauridae")).toBeInTheDocument();
  // Genera are now rolled up, so their names no longer head a row.
  expect(within(region).queryByText("Nanotyrannus")).toBeNull();
});

test("selecting a taxon opens its panel with the profile action", async () => {
  const user = await enterTaxonMode();
  const region = screen.getByRole("region", { name: /taxa on the map/i });
  await user.click(
    within(region).getByRole("button", { name: /Tyrannosaurus/ }),
  );

  const panel = screen.getByRole("region", { name: /taxon:/i });
  expect(
    within(panel).getByRole("button", { name: /open taxon profile/i }),
  ).toBeInTheDocument();
});
