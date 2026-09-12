/**
 * ECharts-backed chart components for this Prefab renderer fork.
 *
 * MODIFIED FROM UPSTREAM: this module does not exist upstream. The upstream
 * charts in `components/charts.tsx` are Recharts-backed; this module is an
 * ECharts-backed replacement that is aliased in place of them by the `./charts`
 * specifier in `components/registry.ts`.
 *
 * Renders with the SVG renderer so chart text (labels, axes) is real DOM text —
 * assertable in tests and crisp at any zoom.
 *
 * See CHANGES.md.
 */

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

import type {
  AreaChartWire,
  BarChartWire,
  LineChartWire,
  PieChartWire,
  RadarChartWire,
  RadialChartWire,
  ScatterChartWire,
} from "@/schemas/chart";
import {
  buildBarChartOption,
  buildLineChartOption,
  buildPieChartOption,
  buildRadarChartOption,
  buildRadialChartOption,
  buildScatterChartOption,
} from "./option";
import { resolveChartPalette } from "./colors";

export { PrefabSparkline } from "@/components/sparkline";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
  SVGRenderer,
]);

/**
 * Rebuild the option only when a wire value or the palette actually changes.
 *
 * Wire props are plain data, so a serialized comparison is sufficient — and
 * necessary: props arrive as a fresh object on every parent render, and
 * re-running the effect would dispose and re-initialise the chart, restarting
 * its animation on every unrelated re-render.
 *
 * The palette is resolved on every render (five 1x1 canvas reads — cheap) so a
 * theme change yields a different palette string and therefore a rebuilt option.
 */
function useOption<T>(
  props: T,
  build: (props: T, palette: string[]) => object,
): EChartsCoreOption {
  const palette = resolveChartPalette();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => build(props, palette), [
    JSON.stringify(props),
    palette.join(","),
  ]) as EChartsCoreOption;
}

function EChart({
  option,
  height,
  className,
  kind,
}: {
  option: EChartsCoreOption;
  height: number;
  className?: string;
  kind: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;

    const chart = echarts.init(node, undefined, { renderer: "svg" });
    chart.setOption(option);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return (
    <div
      ref={container}
      className={className}
      style={{ height, width: "100%" }}
      data-prefab-chart={kind}
    />
  );
}

/** Unresolved bound queries arrive as a string; render nothing until they land. */
function isPending(data: unknown): boolean {
  return typeof data === "string";
}

export function PrefabBarChart({
  className,
  ...props
}: BarChartWire & { className?: string }) {
  const option = useOption(props, buildBarChartOption);
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="bar"
    />
  );
}

export function PrefabLineChart({
  className,
  ...props
}: LineChartWire & { className?: string }) {
  const option = useOption(props, (p, palette) =>
    buildLineChartOption({ ...p, area: false }, palette),
  );
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="line"
    />
  );
}

export function PrefabAreaChart({
  className,
  ...props
}: AreaChartWire & { className?: string }) {
  const option = useOption(props, (p, palette) =>
    buildLineChartOption({ ...p, area: true }, palette),
  );
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="area"
    />
  );
}

export function PrefabPieChart({
  className,
  ...props
}: PieChartWire & { className?: string }) {
  const option = useOption(props, buildPieChartOption);
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="pie"
    />
  );
}

export function PrefabRadarChart({
  className,
  ...props
}: RadarChartWire & { className?: string }) {
  const option = useOption(props, buildRadarChartOption);
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="radar"
    />
  );
}

export function PrefabRadialChart({
  className,
  ...props
}: RadialChartWire & { className?: string }) {
  const option = useOption(props, buildRadialChartOption);
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="radial"
    />
  );
}

export function PrefabScatterChart({
  className,
  ...props
}: ScatterChartWire & { className?: string }) {
  const option = useOption(props, buildScatterChartOption);
  if (isPending(props.data)) return null;
  return (
    <EChart
      option={option}
      height={props.height ?? 300}
      className={className}
      kind="scatter"
    />
  );
}
