import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SPEC-030 UX-002 — the image credit's touch rule, verified by source
 * inspection.
 *
 * Two of UX-002's three parts are checked end-to-end in
 * `test/e2e/phone-touch.e2e.ts`. The image credit is not, and the reason is
 * worth recording rather than hiding behind a skipped test:
 *
 * **The taxon profile renders no illustration at all in the shipped snapshot.**
 * Measured 2026-09-02 on the built app, at 390×664 and at 1280×900, navigating
 * to *Tyrannosaurus* (`txn:38613`) — whose profile in `public/data/reference.json`
 * does carry `imageUrl` entries: the profile screen paints its lineage and no
 * `<img>` anywhere. So P-08's "the credit is hidden behind a hover" is, today,
 * doubly unreachable, and an e2e assertion would be asserting nothing.
 *
 * That gap is **pre-existing and outside this spec** — it belongs to the
 * illustration work (SPEC-012 / SPEC-014), not to the phone layout — so it is
 * recorded as a known limitation and a follow-up rather than fixed here.
 *
 * jsdom does not evaluate media queries either, so a component test could not
 * cover it. Inspecting the rule is the honest remaining option: it verifies the
 * fix is present and cannot silently regress, and it does not pretend to verify
 * that a reader sees it.
 */

const CSS = readFileSync(
  new URL("../../src/app/components/exploration.module.css", import.meta.url),
  "utf8",
);

/** The block a rule lives in, or null when the rule is not inside one. */
function enclosingAtRule(css: string, needle: string): string | null {
  const at = css.indexOf(needle);
  if (at === -1) return null;
  // Walk back to the nearest unclosed `{`, then to the at-rule that opened it.
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    if (css[i] === "}") depth++;
    else if (css[i] === "{") {
      if (depth === 0) {
        const head = css.slice(0, i).split("\n").pop() ?? "";
        return head.trim();
      }
      depth--;
    }
  }
  return null;
}

describe("UX-002: the image credit does not depend on hover", () => {
  it("declares the credit visible under `hover: none`", () => {
    // The gallery's credit is `opacity: 0` at rest and revealed on hover, which
    // on a touch device reveals it to nobody — CONS-490 and charter §2.
    const index = CSS.indexOf("@media (hover: none)");
    expect(
      index,
      "no `hover: none` block in the exploration styles",
    ).toBeGreaterThan(-1);

    const block = CSS.slice(index, CSS.indexOf("}\n}", index) + 3);
    expect(block).toContain(".credReveal");
    expect(block).toMatch(/opacity:\s*1/);
  });

  it("keeps the hover reveal for pointers that have one", () => {
    // The fix adds a touch case; it does not remove the mouse behaviour.
    expect(CSS).toContain(".leadFrame:hover .credReveal");
  });

  it("scopes the touch rule to a media query rather than making it global", () => {
    const scope = enclosingAtRule(CSS, ".credReveal {\n    opacity: 1;");
    expect(scope).toContain("@media (hover: none)");
  });
});
