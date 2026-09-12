import { describe, expect, it } from "vitest";

import {
  CHART_COLORS,
  FALLBACK_PALETTE,
  resolveChartPalette,
  toEChartsColor,
} from "./colors";

/**
 * These run in a node environment, where there is no DOM, so they cover the
 * passthrough contract rather than the canvas conversion itself. That conversion
 * needs a browser's colour parser and is exercised by the renderer at runtime.
 */
describe("colour resolution without a DOM", () => {
  it("passes a colour through unchanged", () => {
    expect(toEChartsColor("#5470c6")).toBe("#5470c6");
  });

  it("passes an unresolved variable through unchanged", () => {
    expect(toEChartsColor("var(--color-chart-1)")).toBe(
      "var(--color-chart-1)",
    );
  });

  it("passes undefined through unchanged", () => {
    expect(toEChartsColor(undefined)).toBeUndefined();
  });

  it("returns the palette unchanged when it cannot be resolved", () => {
    expect(resolveChartPalette()).toEqual(CHART_COLORS);
  });
});

describe("fallback palette", () => {
  it("covers every palette slot", () => {
    expect(FALLBACK_PALETTE).toHaveLength(CHART_COLORS.length);
  });

  it("holds only hex colours, which ECharts can parse", () => {
    // The whole point: an unparseable colour reaching ECharts fails silently.
    for (const colour of FALLBACK_PALETTE) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
