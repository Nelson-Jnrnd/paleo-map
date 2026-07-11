/**
 * Vitest setup for UI tests: registers jest-dom matchers (SPEC-002 REQ-008).
 * Imported by all suites; the data-layer node tests simply gain the matchers,
 * which is harmless.
 */
import '@testing-library/jest-dom/vitest';

// jsdom has no canvas/WebGL. Stub getContext to return null so the map's WebGL
// guard degrades to the accessible list quietly, instead of jsdom logging a
// noisy "Not implemented: HTMLCanvasElement.prototype.getContext".
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
