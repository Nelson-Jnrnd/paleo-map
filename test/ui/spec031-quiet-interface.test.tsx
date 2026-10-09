// @vitest-environment jsdom
/** SPEC-031: the quiet entry, evidence disclosures and secondary navigation. */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { RecordDetails } from "../../src/app/components/RecordDetails.js";
import { ReadApi } from "../../src/read/api.js";
import { fixtureApi } from "./app-harness.js";
import { paddedModel } from "./spec019-harness.js";

afterEach(() => {
  cleanup();
  globalThis.location.hash = "";
});

async function app() {
  const api = await fixtureApi();
  const rendered = render(<ExplorationView api={api} />);
  return { api, ...rendered, user: userEvent.setup() };
}

test("REQ-001/002: map entry hides the directory and retains a distinct record total", async () => {
  const { container, user } = await app();
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  const total = Number(
    container.querySelector("[data-occurrence-count]")?.textContent,
  );
  expect(total).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Browse dinosaurs" }));
  const directory = screen.getByRole("region", { name: "Genus on the map" });
  expect(within(directory).getByText(/genera at this age/)).toBeTruthy();
  expect(within(directory).getAllByRole("button").length).toBeLessThanOrEqual(
    total,
  );
  expect(container.querySelector("[data-occurrence-count]")?.textContent).toBe(
    String(total),
  );
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("REQ-003: fossil evidence has two deliberate disclosures and retains record identity", async () => {
  const api = await fixtureApi();
  const occurrence = api.listOccurrences()[0]!;
  const { container } = render(
    <RecordDetails api={api} occurrences={[occurrence]} />,
  );
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  await userEvent.click(screen.getByText("Details and sources"));
  expect(details.open).toBe(true);
  const record = details.querySelector("details")!;
  expect(record.open).toBe(false);
  await userEvent.click(record.querySelector("summary")!);
  expect(record.open).toBe(true);
  expect(screen.getByText(occurrence.id)).toBeTruthy();
  expect(screen.getAllByText("Source").length).toBeGreaterThan(0);
  expect(screen.queryByText(/Not available|Missing/)).toBeNull();
});

test("REQ-004: selection reaches related groups and map context survives return", async () => {
  const { user } = await app();
  await user.click(screen.getByRole("button", { name: "Browse dinosaurs" }));
  const list = screen.getByRole("region", { name: "Genus on the map" });
  await user.click(within(list).getByRole("button", { name: /Tyrannosaurus/ }));
  await user.click(screen.getByRole("button", { name: "Related groups" }));
  expect(screen.getByRole("region", { name: "Taxonomy" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Related groups" }),
  ).toHaveAttribute("aria-pressed", "true");
  await user.click(
    within(screen.getByRole("navigation", { name: "Main" })).getByRole(
      "button",
      { name: "Map" },
    ),
  );
  expect(
    screen.getByRole("region", { name: /taxon: Tyrannosaurus/i }),
  ).toBeTruthy();
});

test("REQ-004: an article offers an external link and returns to its selected map item", async () => {
  const { user } = await app();
  await user.click(screen.getByRole("button", { name: "Browse dinosaurs" }));
  await user.click(
    within(screen.getByRole("region", { name: "Genus on the map" })).getByRole(
      "button",
      { name: /Tyrannosaurus/ },
    ),
  );
  await user.click(
    screen.getByRole("button", { name: "Read about this dinosaur" }),
  );
  expect(
    screen.getByRole("link", { name: "Open on Wikipedia" }),
  ).toHaveAttribute("href", expect.stringContaining("en.wikipedia.org/wiki/"));
  expect(screen.getByTitle(/Wikipedia article: Tyrannosaurus/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to map" }));
  expect(
    screen.getByRole("region", { name: /taxon: Tyrannosaurus/i }),
  ).toBeTruthy();
});

test("REQ-005: ordinary puzzle navigation selects Well-known; explicit full address is preserved", async () => {
  const base = paddedModel();
  const api = ReadApi.fromModel({
    ...base,
    profiles: base.profiles.map((p, i) => ({ ...p, popularity: 500000 - i })),
  });
  render(<ExplorationView api={api} />);
  await userEvent.click(screen.getByRole("button", { name: "Dinordle" }));
  expect(screen.getByRole("radio", { name: "Well-known" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  cleanup();
  globalThis.location.hash = "#daily";
  render(<ExplorationView api={api} />);
  expect(
    await screen.findByRole("radio", { name: "Every genus" }),
  ).toHaveAttribute("aria-checked", "true");
});
