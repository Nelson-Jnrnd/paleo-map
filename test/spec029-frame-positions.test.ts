/**
 * SPEC-029 REQ-003, NFR-002 — the frame accessor, and the rule that everything
 * which *places* a point goes through it.
 *
 * The source scan at the bottom is the load-bearing test. The verdicts here are
 * three lines; the failure this spec exists to prevent is a future placement
 * site reading `paleoPosition` directly and quietly drawing dots in one frame
 * over a coastline in another. That failure is invisible in a screenshot — a
 * point in the wrong hemisphere looks like data — so it is guarded structurally.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { pointIn, positionIn } from "../src/app/state/frame.js";
import { framePoints, occurrencesInView } from "../src/app/state/viewport.js";
import type { ReadOccurrence } from "../src/domain/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const occ = (
  id: string,
  paleo: { lng: number; lat: number } | null,
  modern: { lng: number; lat: number } | null,
): ReadOccurrence =>
  ({
    id,
    taxonId: `t:${id}`,
    paleoPosition: {
      value: paleo
        ? {
            palaeoLng: paleo.lng,
            palaeoLat: paleo.lat,
            rotationModel: "scotese",
          }
        : null,
    },
    modernPosition: {
      value: modern
        ? { lng: modern.lng, lat: modern.lat, region: "Somewhere, US" }
        : null,
    },
  }) as unknown as ReadOccurrence;

// A collection reconstructed a long way from where it sits today: the whole
// point of the toggle, and the case where mixing frames would be obvious.
const utah = occ("utah", { lng: -60, lat: 12 }, { lng: -111, lat: 39 });

describe("REQ-003: positionIn", () => {
  test("paleo mode returns the reconstructed coordinate", () => {
    expect(positionIn(utah, "paleo")).toEqual({ lng: -60, lat: 12 });
  });

  test("present mode returns the recorded coordinate", () => {
    expect(positionIn(utah, "present")).toEqual({ lng: -111, lat: 39 });
  });

  test("the two frames really differ, so a mix-up would be visible here", () => {
    expect(positionIn(utah, "paleo")).not.toEqual(positionIn(utah, "present"));
  });

  test("null when the active frame has no position, and only then", () => {
    const noPaleo = occ("a", null, { lng: 1, lat: 2 });
    expect(positionIn(noPaleo, "paleo")).toBeNull();
    expect(positionIn(noPaleo, "present")).toEqual({ lng: 1, lat: 2 });

    const noModern = occ("b", { lng: 3, lat: 4 }, null);
    expect(positionIn(noModern, "present")).toBeNull();
    expect(positionIn(noModern, "paleo")).toEqual({ lng: 3, lat: 4 });
  });

  test("pointIn is the same rule, for a locality group's pair of positions", () => {
    // A locality carries the pair without being an occurrence; both callers
    // must resolve the frame identically.
    const paleo = { palaeoLng: -60, palaeoLat: 12, rotationModel: "scotese" };
    const modern = { lng: -111, lat: 39, region: "Utah, US" };
    expect(pointIn(paleo, modern, "paleo")).toEqual(positionIn(utah, "paleo"));
    expect(pointIn(paleo, modern, "present")).toEqual(
      positionIn(utah, "present"),
    );
    expect(pointIn(null, modern, "paleo")).toBeNull();
    expect(pointIn(paleo, null, "present")).toBeNull();
  });
});

describe("REQ-003: the viewport filters in the active frame", () => {
  // A box over the present-day American west. The paleo position of `utah` is
  // far outside it, so the two frames give opposite answers for one occurrence.
  const west = { west: -120, south: 30, east: -100, north: 50 };

  test("present mode keeps a collection whose modern position is in the box", () => {
    expect(occurrencesInView([utah], west, "present").map((o) => o.id)).toEqual(
      ["utah"],
    );
  });

  test("paleo mode drops it, because its reconstruction is elsewhere", () => {
    expect(occurrencesInView([utah], west, "paleo")).toEqual([]);
  });

  test("the mode defaults to paleo, so existing callers are unaffected", () => {
    expect(occurrencesInView([utah], west)).toEqual(
      occurrencesInView([utah], west, "paleo"),
    );
  });

  test("framePoints follows the frame too, so the camera fits what is drawn", () => {
    expect(framePoints([utah], "present")).toEqual([{ lng: -111, lat: 39 }]);
    expect(framePoints([utah], "paleo")).toEqual([{ lng: -60, lat: 12 }]);
    expect(framePoints([utah])).toEqual(framePoints([utah], "paleo"));
  });
});

describe("REQ-003: no placement site reads a position field directly", () => {
  // `OccurrencePanel` is the one deliberate exemption: it *reports* both
  // positions as facts about the occurrence rather than placing anything, and
  // SPEC-029 REQ-003 records that.
  const placementSites = [
    "src/app/components/OccurrenceMap.tsx",
    "src/app/state/viewport.ts",
  ];

  test.each(placementSites)("%s resolves positions via the accessor", (rel) => {
    const source = readFileSync(join(repoRoot, rel), "utf-8");
    // Strip comments: the prose in this repo names these fields constantly, and
    // a comment cannot place a point.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.palaeoLng|\.palaeoLat/);
    expect(code).not.toMatch(/modernPosition\.value\s*[?.]*\s*\.\s*(lng|lat)/);
    expect(code).toMatch(/pointIn|positionIn|framePoints/);
  });

  test("the grouping layer carries both positions so a locality can follow", () => {
    const source = readFileSync(
      join(repoRoot, "src/app/state/grouping.ts"),
      "utf-8",
    );
    expect(source).toMatch(/modern:\s*o\.modernPosition\.value/);
    expect(source).toMatch(/paleo:\s*o\.paleoPosition\.value/);
  });
});
