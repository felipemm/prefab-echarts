/**
 * Pure option builders for the ECharts-backed chart layer.
 *
 * MODIFIED FROM UPSTREAM: this file does not exist upstream. Kept free of React
 * (and of the Recharts modules) so option construction can be unit-tested in a
 * node environment and rendered through ECharts' server-side renderer — no
 * jsdom required. See CHANGES.md.
 */

import { interpolateString } from "@/interpolation";

// Mirrors the palette in components/charts.tsx so ECharts-backed and
// Recharts-backed charts stay visually consistent while the port proceeds.
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export interface ChartSeriesSpec {
  dataKey: string;
  label?: string;
  color?: string;
}

type Row = Record<string, unknown>;
type Formatter = (value: unknown) => string;

/** `data` arrives as a string while a bound query is still unresolved. */
function rowsOf(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

export function getValueFormatter(format?: string): Formatter | undefined {
  if (!format || format === "auto") {
    return undefined;
  }
  return (value: unknown) => {
    const formatted = interpolateString(`{{ _v | ${format} }}`, { _v: value });
    return formatted == null ? "" : String(formatted);
  };
}

/**
 * ECharts 6 replaced `containLabel` with outer bounds. Using the old name still
 * renders but logs a deprecation warning and needs LegacyGridContainLabel, so
 * every grid here uses the documented replacement.
 */
const GRID = {
  left: 8,
  right: 8,
  bottom: 8,
  outerBoundsMode: "same" as const,
  outerBoundsContain: "axisLabel" as const,
};

function frame({
  animate,
  showLegend,
  showTooltip,
  formatValue,
}: {
  animate: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  formatValue?: Formatter;
}) {
  return {
    animation: animate,
    grid: { ...GRID, top: showLegend ? 28 : 8 },
    tooltip: showTooltip
      ? { trigger: "axis" as const, valueFormatter: formatValue }
      : { show: false },
    legend: { show: showLegend, top: 0 },
  };
}

function categoryAxis(rows: Row[], xAxis?: string, boundaryGap = true) {
  return {
    type: "category" as const,
    data: rows.map((row) => String(row[xAxis ?? ""] ?? "")),
    boundaryGap,
    axisTick: { show: false },
    axisLine: { show: false },
  };
}

function valueAxis(
  showYAxis: boolean,
  showGrid: boolean,
  formatValue?: Formatter,
) {
  return {
    type: "value" as const,
    show: showYAxis,
    splitLine: { show: showGrid },
    axisLabel: { show: showYAxis, formatter: formatValue },
  };
}

// ------------------------------------------------------------------ bar

export interface BarChartOptionArgs {
  data?: Row[] | string;
  series: ChartSeriesSpec[];
  xAxis?: string;
  stacked?: boolean;
  horizontal?: boolean;
  barRadius?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  showGrid?: boolean;
  showYAxis?: boolean;
  valueFormat?: string;
  /** Value labels drawn on each series point. */
  showLabels?: boolean;
}

export function buildBarChartOption({
  data = [],
  series,
  xAxis,
  stacked = false,
  horizontal = false,
  barRadius = 4,
  showLegend = false,
  showTooltip = true,
  animate = true,
  showGrid = true,
  showYAxis = true,
  valueFormat = "auto",
  showLabels = false,
}: BarChartOptionArgs) {
  const rows = rowsOf(data);
  const formatValue = getValueFormatter(valueFormat);

  return {
    ...frame({ animate, showLegend, showTooltip, formatValue }),
    xAxis: horizontal
      ? valueAxis(showYAxis, showGrid, formatValue)
      : categoryAxis(rows, xAxis),
    yAxis: horizontal
      ? categoryAxis(rows, xAxis)
      : valueAxis(showYAxis, showGrid, formatValue),
    series: series.map((s, i) => ({
      type: "bar" as const,
      name: s.label ?? s.dataKey,
      data: rows.map((row) => row[s.dataKey] ?? null),
      stack: stacked ? "total" : undefined,
      itemStyle: {
        color: s.color ?? CHART_COLORS[i % CHART_COLORS.length],
        borderRadius: horizontal
          ? [0, barRadius, barRadius, 0]
          : [barRadius, barRadius, 0, 0],
      },
      label: {
        show: showLabels,
        position: horizontal ? ("right" as const) : ("top" as const),
        fontSize: 11,
        // `{c}` is ECharts' value placeholder. Bar labels happen to default to
        // the value, line labels do not, so state it rather than rely on it.
        formatter: !showLabels
          ? undefined
          : formatValue
            ? (params: { value: unknown }) => formatValue(params.value)
            : "{c}",
      },
      emphasis: { focus: "series" as const },
    })),
  };
}

// ----------------------------------------------------------- line / area

export interface LineChartOptionArgs {
  data?: Row[] | string;
  series: ChartSeriesSpec[];
  xAxis?: string;
  /** Area charts fill under the line and may stack. */
  area?: boolean;
  stacked?: boolean;
  curve?: "linear" | "smooth" | "step";
  showDots?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  showGrid?: boolean;
  showYAxis?: boolean;
  valueFormat?: string;
  showLabels?: boolean;
}

export function buildLineChartOption({
  data = [],
  series,
  xAxis,
  area = false,
  stacked = false,
  curve = "linear",
  showDots = false,
  showLegend = false,
  showTooltip = true,
  animate = true,
  showGrid = true,
  showYAxis = true,
  valueFormat = "auto",
  showLabels = false,
}: LineChartOptionArgs) {
  const rows = rowsOf(data);
  const formatValue = getValueFormatter(valueFormat);

  const smooth = curve === "smooth";
  const step = curve === "step" ? ("middle" as const) : undefined;

  return {
    ...frame({ animate, showLegend, showTooltip, formatValue }),
    xAxis: categoryAxis(rows, xAxis, false),
    yAxis: valueAxis(showYAxis, showGrid, formatValue),
    series: series.map((s, i) => {
      const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
      return {
        type: "line" as const,
        name: s.label ?? s.dataKey,
        data: rows.map((row) => row[s.dataKey] ?? null),
        smooth,
        step,
        // ECharts only draws line labels at symbols, and silently drops them
        // when showSymbol is false — so requesting labels forces symbols on.
        // Upstream (Recharts) draws labels independently of the dots.
        showSymbol: showDots || showLabels,
        stack: area && stacked ? "total" : undefined,
        areaStyle: area ? { opacity: 0.4 } : undefined,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        label: {
          show: showLabels,
          position: "top" as const,
          fontSize: 11,
          formatter: !showLabels
            ? undefined
            : formatValue
              ? (params: { value: unknown }) => formatValue(params.value)
              : "{c}",
        },
      };
    }),
  };
}

// ------------------------------------------------------------------ pie

export interface PieChartOptionArgs {
  data?: Row[] | string;
  dataKey: string;
  nameKey: string;
  innerRadius?: number;
  showLabel?: boolean;
  paddingAngle?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  valueFormat?: string;
}

export function buildPieChartOption({
  data = [],
  dataKey,
  nameKey,
  innerRadius = 0,
  showLabel = false,
  paddingAngle = 0,
  showLegend = false,
  showTooltip = true,
  animate = true,
  valueFormat = "auto",
}: PieChartOptionArgs) {
  const rows = rowsOf(data);
  const formatValue = getValueFormatter(valueFormat);

  // Percentage-based radii so the chart adapts to its container, matching
  // upstream's behaviour; labels need room, so shrink when they are shown.
  const outerPct = showLabel ? 60 : 80;
  const innerPct =
    innerRadius > 0 ? Math.round((innerRadius / 100) * outerPct) : 0;

  return {
    animation: animate,
    tooltip: showTooltip
      ? { trigger: "item" as const, valueFormatter: formatValue }
      : { show: false },
    legend: { show: showLegend, bottom: 0 },
    series: [
      {
        type: "pie" as const,
        radius: [`${innerPct}%`, `${outerPct}%`],
        center: ["50%", showLegend ? "45%" : "50%"],
        padAngle: paddingAngle,
        avoidLabelOverlap: true,
        data: rows.map((row, i) => ({
          name: String(row[nameKey] ?? ""),
          value: row[dataKey] ?? null,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
        label: {
          show: showLabel,
          // `{c}` is ECharts' value placeholder: upstream's slice labels show
          // the value, whereas ECharts' pie labels default to the name.
          formatter: formatValue
            ? (params: { value: unknown }) => formatValue(params.value)
            : "{c}",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------- radar

export interface RadarChartOptionArgs {
  data?: Row[] | string;
  series: ChartSeriesSpec[];
  axisKey?: string;
  filled?: boolean;
  showDots?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  showGrid?: boolean;
}

export function buildRadarChartOption({
  data = [],
  series,
  axisKey,
  filled = true,
  showDots = false,
  showLegend = false,
  showTooltip = true,
  animate = true,
  showGrid = true,
}: RadarChartOptionArgs) {
  const rows = rowsOf(data);

  // ECharts wants indicators on the radar component and each series as an
  // array of values in indicator order, where Recharts takes one row per axis.
  const max = Math.max(
    1,
    ...rows.flatMap((row) => series.map((s) => Number(row[s.dataKey]) || 0)),
  );

  return {
    animation: animate,
    tooltip: showTooltip ? { trigger: "item" as const } : { show: false },
    legend: { show: showLegend, top: 0 },
    radar: {
      indicator: rows.map((row) => ({
        name: String(row[axisKey ?? ""] ?? ""),
        max,
      })),
      splitLine: { show: showGrid },
      splitArea: { show: false },
      axisLine: { show: showGrid },
    },
    series: [
      {
        type: "radar" as const,
        symbol: showDots ? ("circle" as const) : ("none" as const),
        data: series.map((s, i) => {
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return {
            name: s.label ?? s.dataKey,
            value: rows.map((row) => Number(row[s.dataKey]) || 0),
            lineStyle: { color },
            itemStyle: { color },
            areaStyle: filled ? { opacity: 0.3, color } : undefined,
          };
        }),
      },
    ],
  };
}

// --------------------------------------------------------------- radial

export interface RadialChartOptionArgs {
  data?: Row[] | string;
  dataKey: string;
  nameKey: string;
  innerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  valueFormat?: string;
}

/**
 * Concentric rings, matching Recharts' RadialBarChart: the angle axis carries a
 * single category so every bar spans the full arc, and the radius axis is
 * categorical so each entry sits at its own radius.
 *
 * Angles are converted because the two libraries measure them from different
 * origins — Recharts from 3 o'clock, ECharts from 12 o'clock.
 */
export function buildRadialChartOption({
  data = [],
  dataKey,
  nameKey,
  innerRadius = 30,
  startAngle = 180,
  endAngle = 0,
  showLegend = false,
  showTooltip = true,
  animate = true,
  valueFormat = "auto",
}: RadialChartOptionArgs) {
  const rows = rowsOf(data);
  const formatValue = getValueFormatter(valueFormat);

  const toEChartsAngle = (angle: number) => ((angle + 90) % 360 + 360) % 360;

  return {
    animation: animate,
    tooltip: showTooltip
      ? { trigger: "item" as const, valueFormatter: formatValue }
      : { show: false },
    legend: { show: showLegend, bottom: 0 },
    polar: {
      radius: [`${innerRadius}%`, "80%"],
      startAngle: toEChartsAngle(startAngle),
      endAngle: toEChartsAngle(endAngle),
    },
    angleAxis: { type: "category" as const, data: [""] },
    radiusAxis: {
      type: "category" as const,
      data: rows.map((row) => String(row[nameKey] ?? "")),
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar" as const,
        coordinateSystem: "polar" as const,
        data: rows.map((row, i) => ({
          value: row[dataKey] ?? null,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  };
}

// -------------------------------------------------------------- scatter

export interface ScatterChartOptionArgs {
  data?: Row[] | string;
  series: ChartSeriesSpec[];
  xAxis: string;
  yAxis: string;
  zAxis?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  showGrid?: boolean;
}

export function buildScatterChartOption({
  data = [],
  series,
  xAxis,
  yAxis,
  zAxis,
  showLegend = false,
  showTooltip = true,
  animate = true,
  showGrid = true,
}: ScatterChartOptionArgs) {
  const rows = rowsOf(data);

  // A single series plots every row; multiple series split on the `_series`
  // marker, matching upstream's behaviour.
  const rowsFor = (dataKey: string) =>
    series.length === 1
      ? rows
      : rows.filter((row) => row._series === dataKey);

  // Bubble sizing: z drives the symbol area, scaled across a readable range.
  const zValues = zAxis
    ? rows.map((row) => Number(row[zAxis]) || 0)
    : [];
  const zMax = Math.max(1, ...zValues);
  const MIN_SIZE = 10;
  const MAX_SIZE = 40;

  return {
    animation: animate,
    grid: { ...GRID, top: showLegend ? 28 : 8 },
    tooltip: showTooltip ? { trigger: "item" as const } : { show: false },
    legend: { show: showLegend, top: 0 },
    xAxis: {
      type: "value" as const,
      name: xAxis,
      splitLine: { show: showGrid },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      name: yAxis,
      splitLine: { show: showGrid },
      axisTick: { show: false },
    },
    series: series.map((s, i) => ({
      type: "scatter" as const,
      name: s.label ?? s.dataKey,
      // With a z axis the third element carries the size driver.
      data: rowsFor(s.dataKey).map((row) =>
        zAxis
          ? [row[xAxis], row[yAxis], row[zAxis]]
          : [row[xAxis], row[yAxis]],
      ),
      symbolSize: zAxis
        ? (value: unknown) => {
            const z = Array.isArray(value) ? Number(value[2]) || 0 : 0;
            return MIN_SIZE + (z / zMax) * (MAX_SIZE - MIN_SIZE);
          }
        : 12,
      itemStyle: {
        color: s.color ?? CHART_COLORS[i % CHART_COLORS.length],
      },
    })),
  };
}
