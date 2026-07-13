// @vitest-environment jsdom
/**
 * SPEC-003 REQ-003 — the keyboard-reachable occurrence list: every visible
 * occurrence is a focusable control showing taxon, time range in Ma and an
 * identifiable source, with reconstructed / approximate / missing marked by text
 * labels, not colour alone (FONC-1100/1130/1140/1150, PERF-140/150/250).
 */

import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ExplorationView } from '../../src/app/components/ExplorationView.js';
import { LIST_RENDER_CAP, OccurrenceList } from '../../src/app/components/OccurrenceList.js';
import type { ReadOccurrence } from '../../src/domain/index.js';
import { fixtureApi } from './app-harness.js';

afterEach(cleanup);

test('lists visible occurrences with source and uncertainty cues', async () => {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  const list = screen.getByRole('region', { name: /Visible occurrences/i });
  const rows = within(list).getAllByRole('button');
  const expected = api.listOccurrences({ stage: 'Maastrichtian' });
  expect(rows).toHaveLength(expected.length);

  // Every visible occurrence carries an identifiable source (PERF-140) and a
  // time range in Ma (PERF-150).
  expect(within(list).getAllByText(/^Source:/)).toHaveLength(expected.length);
  expect(within(list).getAllByText(/Ma$/).length).toBeGreaterThanOrEqual(expected.length);

  // Reconstructed positions and the approximate range are labeled with text.
  expect(within(list).getAllByText('Reconstructed').length).toBeGreaterThan(0);
  expect(within(list).getByText('Approximate')).toBeInTheDocument();

  // The occurrence with no paleocoordinate is shown with an explicit label.
  expect(within(list).getAllByText('Not available').length).toBeGreaterThan(0);

  // Rows are real, focusable controls (keyboard reachable — PERF-230).
  const first = rows[0]!;
  first.focus();
  expect(first).toHaveFocus();
});

test('caps the rendered list at real scale but keeps the count and a refine hint (AMEND-001)', async () => {
  const api = await fixtureApi();
  const base = api.listOccurrences({ stage: 'Maastrichtian' });
  // Synthesize a large filtered set by cloning the fixture occurrences.
  const many: ReadOccurrence[] = Array.from({ length: 250 }, (_, i) => {
    const src = base[i % base.length]!;
    return { ...src, id: `occ:scale:${i}` };
  });

  render(<OccurrenceList api={api} occurrences={many} selectedId={null} onSelect={() => {}} />);
  const list = screen.getByRole('region', { name: /Visible occurrences/i });

  // Only the cap is rendered as DOM rows, not all 250 (PERF-020/030).
  expect(within(list).getAllByRole('button')).toHaveLength(LIST_RENDER_CAP);
  // The full total and a way to reach the rest are shown, not hidden.
  expect(within(list).getByText(new RegExp(`Showing ${LIST_RENDER_CAP} of 250`))).toBeInTheDocument();
});

test('a selected occurrence beyond the cap is still surfaced in the list', async () => {
  const api = await fixtureApi();
  const base = api.listOccurrences({ stage: 'Maastrichtian' });
  const many: ReadOccurrence[] = Array.from({ length: 250 }, (_, i) => {
    const src = base[i % base.length]!;
    return { ...src, id: `occ:scale:${i}` };
  });

  render(
    <OccurrenceList api={api} occurrences={many} selectedId="occ:scale:240" onSelect={() => {}} />,
  );
  const list = screen.getByRole('region', { name: /Visible occurrences/i });
  const current = within(list)
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-current') === 'true');
  expect(current).toBeDefined();
});
