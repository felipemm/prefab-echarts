/**
 * ECharts-backed chart components for this Prefab renderer fork.
 *
 * MODIFIED FROM UPSTREAM: this module does not exist upstream. The upstream
 * charts in `components/charts.tsx` are Recharts-backed; this module is an
 * ECharts-backed drop-in that is aliased in place of them, so charts can be
 * ported one type at a time. Not-yet-ported charts are re-exported from the
 * upstream implementation and continue to render through Recharts.
 *
 * Renders with the SVG renderer so chart text (labels, axes) is real DOM text —
 * assertable in tests and crisp at any zoom.
 *
 * See CHANGES.md.
 */

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

import type { BarChartWire } from "@/schemas/chart";
import { buildBarChartOption } from "./option";

// Charts not yet ported still render through the upstream Recharts implementation.
export {
  PrefabLineChart,
  PrefabAreaChart,
  PrefabPieChart,
  PrefabRadarChart,
  PrefabRadialChart,
  PrefabScatterChart,
} from "@/components/charts";
export { PrefabSparkline } from "@/components/sparkline";

export { buildBarChartOption } from "./option";

echarts.use([
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

export function PrefabBarChart({
  className,
  ...props
}: BarChartWire & { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const height = props.height ?? 300;

  const option = useMemo(() => buildBarChartOption(props), [props]);

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

  // `data` arrives as a string while a bound query is still unresolved.
  if (typeof props.data === "string") return null;

  return (
    <div
      ref={container}
      className={className}
      style={{ height, width: "100%" }}
      data-prefab-chart="bar"
    />
  );
}
