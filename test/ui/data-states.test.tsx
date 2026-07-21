// @vitest-environment jsdom
/**
 * SPEC-003 REQ-008 — required data states: a loading indicator on initial load,
 * an error state with Retry that recovers, and a minimal-data label on a sparse
 * profile (FONC-1260/1300/1310/1330, PERF-050).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App.js";
import { TaxonProfile } from "../../src/app/components/TaxonProfile.js";
import type { ReadModel } from "../../src/domain/index.js";
import { fixtureApi, fixtureModel } from "./app-harness.js";

afterEach(cleanup);

test("shows a loading indicator while the snapshot loads (FONC-1260)", () => {
  const pending: () => Promise<ReadModel> = () =>
    new Promise<ReadModel>(() => {});
  render(<App loader={pending} />);
  // SPEC-006: the loading surface shows a progressbar and a download label.
  expect(screen.getByRole("status")).toHaveTextContent(
    /Downloading fossil data/i,
  );
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

test("shows an error with Retry that recovers (FONC-1310/1330)", async () => {
  const user = userEvent.setup();
  let calls = 0;
  const loader = (): Promise<ReadModel> => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error("offline")) : fixtureModel();
  };
  render(<App loader={loader} />);

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/Could not load the snapshot/i);
  expect(alert).toHaveTextContent(/offline/);

  await user.click(screen.getByRole("button", { name: /Retry/i }));

  // Recovery: the exploration view loads on the second attempt.
  expect(
    await screen.findByRole("navigation", { name: /timeline/i }),
  ).toBeInTheDocument();
});

test("labels a minimal (occurrence-only) profile (FONC-1300)", async () => {
  const api = await fixtureApi();
  render(
    <TaxonProfile api={api} taxonId="txn:nanotyrannus" onBack={() => {}} />,
  );

  expect(
    screen.getByText(/Occurrence only — minimal profile/i),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Back to map/i }),
  ).toBeInTheDocument();
});

test("taxon profile for an indeterminate/unknown taxon is an honest, navigable screen", async () => {
  const api = await fixtureApi();
  render(
    <TaxonProfile api={api} taxonId="txn:not-a-real-taxon" onBack={() => {}} />,
  );
  expect(
    screen.getByRole("region", { name: /Taxon profile:/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Indeterminate identification/i)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Back to map/i }),
  ).toBeInTheDocument();
});
