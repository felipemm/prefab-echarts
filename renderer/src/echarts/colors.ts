/**
 * Colour resolution for the ECharts chart layer.
 *
 * MODIFIED FROM UPSTREAM: this file does not exist upstream.
 *
 * ECharts parses colours itself — to lift them for hover, to build gradients and
 * to tint legend swatches — and its parser understands only legacy CSS forms.
 * Measured against echarts 6.1.0:
 *
 *   color.parse("var(--color-chart-1)")  -> undefined
 *   color.parse("oklch(0.65 0.25 260)")  -> undefined
 *   color.parse("hsl(260 60% 60%)")      -> undefined   (space-separated form)
 *   color.parse("#5470c6")               -> [84, 112, 198, 1]
 *
 * The renderer's palette is `oklch()` behind a `var()`, so every derived colour
 * came back undefined and the element was drawn with no fill: hovering a bar or
 * a line made it visibly vanish until the pointer moved away.
 *
 * Palette values are therefore converted to sRGB before they reach ECharts,
 * using the browser's own colour parser via a 1x1 canvas readback. That copes
 * with any form the browser accepts, including the colour functions ECharts has
 * never heard of. Outside a browser the input is returned unchanged, which keeps
 * the option builders unit-testable.
 *
 * See CHANGES.md.
 */

/** The CSS variables holding the renderer's chart palette, in order. */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/** Concrete sRGB stand-ins, used when the palette cannot be resolved. */
export const FALLBACK_PALETTE = [
  "#6366f1",
  "#10b981",
  "#ec4899",
  "#f59e0b",
  "#8b5cf6",
];

/** Anything ECharts' parser cannot read, and therefore must not be passed on. */
const UNPARSEABLE = /oklch\(|var\(|color\(|color-mix\(/i;

const SENTINEL = "#010203";

let probe: HTMLCanvasElement | null = null;

function probeContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!probe) {
    probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
  }
  return probe.getContext("2d");
}

/** Resolve `var(--x)` references against the document root. */
function substituteVars(value: string): string {
  if (typeof document === "undefined" || !value.includes("var(")) return value;
  const computed = getComputedStyle(document.documentElement);
  return value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_match, name: string, fallback?: string) =>
      computed.getPropertyValue(name).trim() || (fallback ?? "").trim(),
  );
}

/**
 * Convert any browser-supported CSS colour to `rgb()`/`rgba()`.
 *
 * Returns the input unchanged when there is no DOM, or when the browser cannot
 * parse it — callers that must not hand ECharts an unparseable colour should use
 * `resolveChartPalette`, which falls back to a concrete palette.
 */
export function toEChartsColor(value: string | undefined): string | undefined {
  if (!value || typeof document === "undefined") return value;

  const resolved = substituteVars(value).trim();
  const ctx = probeContext();
  if (!ctx) return resolved;

  // An unsupported colour is ignored by the canvas, leaving the sentinel behind.
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = resolved;
  if (String(ctx.fillStyle).toLowerCase() === SENTINEL) return resolved;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

  if (a === 0) return resolved;
  if (a === 255) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${Number((a / 255).toFixed(3))})`;
}

/**
 * Resolve the chart palette to colours ECharts can parse.
 *
 * Falls back to `FALLBACK_PALETTE` rather than passing an unparseable value on:
 * an `oklch()` reaching ECharts is exactly the bug this exists to prevent, and
 * it fails silently.
 */
export function resolveChartPalette(
  vars: string[] = CHART_COLORS,
): string[] {
  if (typeof document === "undefined") return vars;

  return vars.map((variable, index) => {
    const resolved = toEChartsColor(variable);
    if (!resolved || UNPARSEABLE.test(resolved)) {
      return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    }
    return resolved;
  });
}
