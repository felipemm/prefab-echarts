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

export interface BarChartOptionArgs {
  /** Array of rows, or a string while a bound query is unresolved. */
  data?: Array<Record<string, unknown>> | string;
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

export function getValueFormatter(format?: string) {
  if (!format || format === "auto") {
    return undefined;
  }
  return (value: unknown) => {
    const formatted = interpolateString(`{{ _v | ${format} }}`, { _v: value });
    return formatted == null ? "" : String(formatted);
  };
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
  const rows = Array.isArray(data) ? data : [];
  const formatValue = getValueFormatter(valueFormat);

  const seriesOption = series.map((s, i) => ({
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
      formatter: showLabels && formatValue
        ? (params: { value: unknown }) => formatValue(params.value)
        : undefined,
    },
    emphasis: { focus: "series" as const },
  }));

  const categoryAxis = {
    type: "category" as const,
    data: rows.map((row) => String(row[xAxis ?? ""] ?? "")),
    axisTick: { show: false },
    axisLine: { show: false },
  };

  const valueAxis = {
    type: "value" as const,
    show: showYAxis,
    splitLine: { show: showGrid },
    axisLabel: { show: showYAxis, formatter: formatValue },
  };

  return {
    animation: animate,
    grid: {
      left: 8,
      right: 8,
      top: showLegend ? 28 : 8,
      bottom: 8,
      // ECharts 6 replaced `containLabel: true` with outer bounds; this is the
      // documented equivalent and avoids needing LegacyGridContainLabel.
      outerBoundsMode: "same" as const,
      outerBoundsContain: "axisLabel" as const,
    },
    tooltip: showTooltip
      ? {
          trigger: "axis" as const,
          axisPointer: { type: "shadow" as const },
          valueFormatter: formatValue,
        }
      : { show: false },
    legend: { show: showLegend, top: 0 },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: seriesOption,
  };
}
