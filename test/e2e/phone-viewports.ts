/**
 * The phone viewport matrix and the shared probes for SPEC-030's layout gates
 * (NFR-001). One definition, imported by every phone suite, so they cannot drift
 * on which widths count as "a phone" or on what "too small to tap" means.
 *
 * It lives outside the `*.e2e.ts` pattern because Playwright forbids one test
 * file importing another.
 */

import type { Page } from "@playwright/test";

/** Portrait phone widths under test, each at its real device height
 *  (SPEC-030 REQ-002 acceptance criteria). */
export const PHONE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 664 },
  { width: 430, height: 730 },
] as const;

/**
 * The coarse-pointer target floor (SPEC-030 UX-001). 44px is the platform
 * minimum; the project's own `--target-min` (24px, PERF-120) stays the floor for
 * fine pointers and is not raised by this.
 */
export const TARGET_MIN_COARSE = 44;

/** An element that escapes the viewport horizontally (REQ-002). */
export interface Overflower {
  tag: string;
  cls: string;
  text: string;
  left: number;
  right: number;
}

/** An enabled interactive element under the coarse-pointer floor (UX-001). */
export interface SmallTarget {
  tag: string;
  cls: string;
  text: string;
  width: number;
  height: number;
}

/**
 * Every element whose border box escapes the viewport's left or right edge.
 * Enumerates rather than naming, so an element added later is covered
 * automatically — the same principle as SPEC-023 NFR-001's box enumeration.
 */
export async function horizontalOverflowers(page: Page): Promise<Overflower[]> {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const out: Overflower[] = [];

    // An element clipped by an ancestor cannot widen the document, however far
    // its own box reaches: `overflow: hidden` clips visually but
    // `getBoundingClientRect()` still reports the untruncated geometry. The
    // loading bar is the case in point — it is a 40%-wide bar animated from
    // `translateX(-110%)` inside a track that clips it, so its rect is off the
    // left edge by design and nothing escapes. Counting it would have made this
    // gate fail on a correct layout.
    const clipped = (el: Element): boolean => {
      const box = el.getBoundingClientRect();
      for (let a = el.parentElement; a; a = a.parentElement) {
        const style = getComputedStyle(a);
        if (style.overflowX === "visible") continue;
        const ab = a.getBoundingClientRect();
        if (box.right > ab.right + 0.5 || box.left < ab.left - 0.5) return true;
      }
      return false;
    };

    for (const el of Array.from(document.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // A scroll container's own children may legitimately sit outside it; the
      // gate is about the *document*, so only count what escapes the viewport.
      if (r.right > clientWidth + 0.5 || r.left < -0.5) {
        if (clipped(el)) continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className ?? "").slice(0, 60),
          text: (el.textContent ?? "").trim().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }
    return out;
  });
}

/**
 * Enabled, visible interactive elements smaller than the coarse-pointer floor.
 *
 * `exempt` names selectors the spec exempts by ID rather than by accident — the
 * to-scale stage steps (REQ-006: 30 × 44px is 1,320px, which does not fit a
 * phone; precise selection is served by the discrete controls instead).
 */
export async function smallTargets(
  page: Page,
  min: number,
  exempt: readonly string[] = [],
): Promise<SmallTarget[]> {
  return page.evaluate(
    ({ min, exempt }) => {
      const sel = "button, a, input, select, [role='radio'], [role='button']";
      const out: SmallTarget[] = [];
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (exempt.some((e) => el.matches(e))) continue;
        if ((el as HTMLButtonElement).disabled) continue;
        // A checkbox or radio wrapped in its own label is not a 13px target:
        // the label is clickable and carries the hit area, which is what WCAG
        // 2.5.8 measures. Skip the inner control and let the label be judged on
        // its own — it is matched by this same query when it has a role, and by
        // the containing row otherwise. Blowing the checkbox itself up to 44px
        // would satisfy a literal reading and make the control worse.
        const label = el.closest("label");
        if (
          label &&
          (el as HTMLInputElement).type &&
          ["checkbox", "radio"].includes((el as HTMLInputElement).type)
        ) {
          const lr = label.getBoundingClientRect();
          if (lr.width >= min - 0.5 && lr.height >= min - 0.5) continue;
        }
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < min - 0.5 || r.height < min - 0.5) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className ?? "").slice(0, 60),
            text: (el.textContent ?? "").trim().slice(0, 30),
            width: Math.round(r.width),
            height: Math.round(r.height),
          });
        }
      }
      return out;
    },
    { min, exempt: [...exempt] },
  );
}

/** Computed font-size of every text input, for the iOS auto-zoom gate (UX-003). */
export async function textInputFontSizes(
  page: Page,
): Promise<Array<{ cls: string; fontSize: number }>> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "input[type='text'], input[type='search'], input:not([type])",
      ),
    ).map((el) => ({
      cls: String(el.className ?? "").slice(0, 60),
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    })),
  );
}

/**
 * Open the phone map screen's controls drawer.
 *
 * Since SPEC-030's amended REQ-005/REQ-006 the taxon search, the to-scale
 * timeline, the frame toggle and Reset view live behind the age strip's
 * disclosure — the map is the subject of that screen, and 205px of permanent
 * chrome on a 664px phone made it a companion instead. Tests that need any of
 * those controls open the drawer first, exactly as a reader would.
 */
export async function openControlsDrawer(page: Page): Promise<void> {
  await page.locator("[data-controls-toggle]").click();
  await page.waitForTimeout(250);
}

/** Wait for the map screen to be painted before measuring it. */
export async function settle(page: Page): Promise<void> {
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 20_000 });
  await page.waitForTimeout(600);
}
