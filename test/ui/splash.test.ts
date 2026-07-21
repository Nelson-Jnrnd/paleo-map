/**
 * SPEC-006 UX-001 / SEC-001 — the served index.html paints a self-contained
 * splash inside #root before the app bundle runs, and pulls in no external asset
 * to do so.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const html = readFileSync(
  fileURLToPath(new URL("../../index.html", import.meta.url)),
  "utf8",
);

test("index.html paints a splash inside #root before the bundle", () => {
  const rootIdx = html.indexOf('<div id="root">');
  const splashIdx = html.indexOf('id="app-splash"');
  const scriptIdx = html.indexOf('src="/src/app/main.tsx"');
  expect(rootIdx).toBeGreaterThan(-1);
  expect(splashIdx).toBeGreaterThan(rootIdx);
  // The splash markup precedes the app entry script, so it is present first paint.
  expect(splashIdx).toBeLessThan(scriptIdx);
  expect(html).toMatch(/role="progressbar"/);
});

test("the splash references no external asset (SEC-001)", () => {
  const splashStart = html.indexOf("<style>");
  const bodyEnd = html.indexOf("</body>");
  const splashRegion = html.slice(splashStart, bodyEnd);
  // No external stylesheet/font/image/script hosts in the pre-JS splash region.
  expect(splashRegion).not.toMatch(/https?:\/\//);
  expect(splashRegion).not.toMatch(/url\(/);
});
