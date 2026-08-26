/**
 * SPEC-028 REQ-002/REQ-003, NFR-002/NFR-003 — the two new clue channels.
 *
 * Pure functions only: this file imports no React and no jsdom, which is the
 * NFR-002 claim under test as much as the verdicts themselves. The band
 * boundaries in REQ-003 are asserted on both sides, because "within a factor of
 * two" is the one number in this spec chosen by measurement rather than by
 * derivation — if it moves, it must move deliberately.
 */

import { describe, expect, test } from "vitest";
import {
  CLOSE_OCCURRENCE_RATIO,
  countryVerdict,
  evaluateGuess,
  occurrenceVerdict,
  sharedCountries,
} from "../src/app/state/dailyGenus.js";
import { fixtureGameData, named } from "./spec019-fixture.js";

const data = fixtureGameData();
const genus = (name: string) => data.guessableById.get(named(data, name).id)!;

describe("REQ-002: shared countries", () => {
  test("the verdict is the intersection, in sorted order", () => {
    expect(sharedCountries(["CA", "US"], ["CA", "US"])).toEqual(["CA", "US"]);
    expect(sharedCountries(["CN", "MN"], ["CA", "US"])).toEqual([]);
    expect(sharedCountries(["PT", "US"], ["CA", "US"])).toEqual(["US"]);
  });

  test("it never reports a country that is not in both sets", () => {
    const shared = sharedCountries(["AR", "BR", "CL"], ["BR", "CL", "ZA"]);
    expect(shared).toEqual(["BR", "CL"]);
    expect(shared).not.toContain("AR");
    expect(shared).not.toContain("ZA");
  });

  test("no overlap is `none`, not `unavailable`", () => {
    expect(countryVerdict(["CN"], ["US"])).toBe("none");
  });

  test("an empty set on either side is `unavailable`, never `none`", () => {
    // The distinction REQ-002 exists for: a genus with no recorded locality
    // country has an *unknown* overlap. Calling that "shares nothing" would be a
    // verdict the snapshot does not support.
    expect(countryVerdict([], ["US"])).toBe("unavailable");
    expect(countryVerdict(["US"], [])).toBe("unavailable");
    expect(countryVerdict([], [])).toBe("unavailable");
  });
});

describe("REQ-003: occurrence comparison", () => {
  test("equal counts are `same`", () => {
    expect(occurrenceVerdict(40, 40)).toBe("same");
    expect(occurrenceVerdict(1, 1)).toBe("same");
  });

  test("the direction is stated from the answer's point of view", () => {
    // The answer has more than the guess -> "more".
    expect(occurrenceVerdict(10, 15)).toBe("more-close");
    expect(occurrenceVerdict(15, 10)).toBe("fewer-close");
  });

  test("`close` is exactly the factor-of-two band, on both sides", () => {
    expect(CLOSE_OCCURRENCE_RATIO).toBe(2);
    // Named boundaries from REQ-003's acceptance criteria.
    expect(occurrenceVerdict(1, 2)).toBe("more-close"); // ratio exactly 2
    expect(occurrenceVerdict(1, 3)).toBe("more-far"); // ratio 3
    expect(occurrenceVerdict(10, 20)).toBe("more-close"); // ratio exactly 2
    expect(occurrenceVerdict(10, 21)).toBe("more-far"); // just over
    expect(occurrenceVerdict(20, 10)).toBe("fewer-close");
    expect(occurrenceVerdict(21, 10)).toBe("fewer-far");
  });

  test("the band is scale-free: it holds at the top of the range too", () => {
    // Why REQ-003 uses a ratio and not an absolute difference. Both of these
    // pairs really are similar in size, and the ratio band says so at either
    // end of a range that runs 1..431. An absolute +/-2 band would split them:
    // 429-vs-431 close, 30-vs-34 far — which is an artefact of the units, not a
    // fact about the counts.
    expect(occurrenceVerdict(431, 429)).toBe("fewer-close");
    expect(occurrenceVerdict(30, 34)).toBe("more-close");
    // And it still separates genuinely different scales at the top of the range.
    expect(occurrenceVerdict(431, 100)).toBe("fewer-far");
  });

  test("a missing count on either side is `unavailable`", () => {
    expect(occurrenceVerdict(null, 5)).toBe("unavailable");
    expect(occurrenceVerdict(5, null)).toBe("unavailable");
    expect(occurrenceVerdict(null, null)).toBe("unavailable");
  });
});

describe("both channels reach the evaluated guess", () => {
  test("a guess carries its own shared countries and occurrence verdict", () => {
    // Gorgosaurus (CA, US · 30) against Tyrannosaurus (CA, US · 40).
    const g = evaluateGuess(genus("Gorgosaurus"), genus("Tyrannosaurus"), data);
    expect(g.sharedCountries).toEqual(["CA", "US"]);
    expect(g.countryVerdict).toBe("shared");
    expect(g.occurrences).toBe("more-close");
  });

  test("a guess sharing no country, with a far count", () => {
    // Velociraptor (CN, MN · 3) against Tyrannosaurus (CA, US · 40).
    const g = evaluateGuess(
      genus("Velociraptor"),
      genus("Tyrannosaurus"),
      data,
    );
    expect(g.sharedCountries).toEqual([]);
    expect(g.countryVerdict).toBe("none");
    expect(g.occurrences).toBe("more-far");
  });

  test("a guess with nothing recorded reports `unavailable` on both", () => {
    // Nyasasaurus has no countries and no occurrences in the fixture.
    const g = evaluateGuess(genus("Nyasasaurus"), genus("Tyrannosaurus"), data);
    expect(g.countryVerdict).toBe("unavailable");
    expect(g.occurrences).toBe("unavailable");
  });

  test("an equal count still reads `same` when the countries differ", () => {
    // Diplodocus (PT, US · 40) against Tyrannosaurus (CA, US · 40): the two
    // channels are independent, and one saying "same" must not colour the other.
    const g = evaluateGuess(genus("Diplodocus"), genus("Tyrannosaurus"), data);
    expect(g.sharedCountries).toEqual(["US"]);
    expect(g.occurrences).toBe("same");
  });
});

describe("NFR-003: determinism", () => {
  test("repeated evaluation of the same pair is identical", () => {
    const once = evaluateGuess(
      genus("Gorgosaurus"),
      genus("Tyrannosaurus"),
      data,
    );
    const twice = evaluateGuess(
      genus("Gorgosaurus"),
      genus("Tyrannosaurus"),
      data,
    );
    expect(twice).toEqual(once);
  });

  test("the result follows the guess's order, not the answer's", () => {
    // The index sorts both sides, so this is normally moot — but the function
    // must not depend on that, or an unsorted caller would get unstable output.
    expect(
      sharedCountries(["AR", "BR", "CN", "US"], ["US", "CN", "AR"]),
    ).toEqual(["AR", "CN", "US"]);
  });
});
