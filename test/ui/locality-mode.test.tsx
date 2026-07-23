// @vitest-environment jsdom
/**
 * SPEC-010 REQ-003 — Locality mode: the list becomes one row per collection, and
 * selecting a locality opens a panel listing the taxa recorded there, each reaching
 * its profile (SPEC-003 loop).
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

async function enterLocalityMode() {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const group = within(
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );
  await user.click(group.getByRole("button", { name: "Localities" }));
  return user;
}

test("lists localities and inspects a locality's taxa", async () => {
  const user = await enterLocalityMode();

  const region = screen.getByRole("region", { name: /localities on the map/i });
  const rows = within(region).getAllByRole("button");
  expect(rows.length).toBeGreaterThan(0);
  // A locality row shows the collection name and a distinct-taxon count.
  expect(within(region).getAllByText(/taxa/i).length).toBeGreaterThan(0);

  await user.click(rows[0]!);

  // The locality panel lists the taxa recorded there, each reaching a profile.
  const panel = screen.getByRole("region", { name: /locality:/i });
  expect(
    within(panel).getAllByRole("button", { name: /open profile/i }).length,
  ).toBeGreaterThan(0);
});

test("selecting a taxon in the locality panel opens its profile (SPEC-003 loop)", async () => {
  const user = await enterLocalityMode();
  const region = screen.getByRole("region", { name: /localities on the map/i });
  await user.click(within(region).getAllByRole("button")[0]!);

  const panel = screen.getByRole("region", { name: /locality:/i });
  await user.click(
    within(panel).getAllByRole("button", { name: /open profile/i })[0]!,
  );

  // Navigated to the taxon profile screen (the back-to-map affordance appears).
  expect(
    screen.getByRole("button", { name: /back to map|↤|←|back/i }),
  ).toBeInTheDocument();
});
