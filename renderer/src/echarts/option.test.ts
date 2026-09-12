import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

import { buildBarChartOption, type BarChartOptionArgs } from "./option";

echarts.use([
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

// Deliberately non-round values: axis ticks land on round numbers, so these
// can only appear in the SVG as data labels.
const data = [
  { month: "Jan", direct: 137, organic: 42 },
  { month: "Feb", direct: 289, organic: 63 },
];

const series = [
  { dataKey: "direct", label: "Direct" },
  { dataKey: "organic", label: "Organic" },
];

/** Render through ECharts' server-side SVG renderer — no DOM required. */
function renderSvg(args: BarChartOptionArgs): string {
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: 600,
    height: 320,
  });
  chart.setOption(buildBarChartOption(args));
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

describe("ECharts bar chart — value labels", () => {
  it("draws a value label for every series point when showLabels is on", () => {
    const svg = renderSvg({ data, series, xAxis: "month", showLabels: true });

    for (const value of ["137", "42", "289", "63"]) {
      expect(svg).toContain(`>${value}<`);
    }
  });

  it("omits value labels when showLabels is off", () => {
    const svg = renderSvg({ data, series, xAxis: "month" });

    expect(svg).not.toContain(">137<");
    expect(svg).not.toContain(">289<");
  });

  it("renders the category axis", () => {
    const svg = renderSvg({ data, series, xAxis: "month" });

    expect(svg).toContain("Jan");
    expect(svg).toContain("Feb");
  });
});

describe("ECharts bar chart — option construction", () => {
  it("puts every series in one stack group when stacked", () => {
    const option = buildBarChartOption({
      data,
      series,
      xAxis: "month",
      stacked: true,
    });

    expect(option.series.map((s) => s.stack)).toEqual(["total", "total"]);
  });

  it("leaves series unstacked by default", () => {
    const option = buildBarChartOption({ data, series, xAxis: "month" });

    expect(option.series.map((s) => s.stack)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("swaps the axes when horizontal", () => {
    const option = buildBarChartOption({
      data,
      series,
      xAxis: "month",
      horizontal: true,
    });

    expect(option.xAxis.type).toBe("value");
    expect(option.yAxis.type).toBe("category");
  });

  it("gives each series a distinct palette colour by default", () => {
    const option = buildBarChartOption({ data, series, xAxis: "month" });
    const colours = option.series.map((s) => s.itemStyle.color);

    expect(new Set(colours).size).toBe(2);
    expect(colours[0]).toBe("var(--color-chart-1)");
    expect(colours[1]).toBe("var(--color-chart-2)");
  });

  it("honours an explicit series colour over the palette", () => {
    const option = buildBarChartOption({
      data,
      series: [{ dataKey: "direct", color: "#ff0000" }],
      xAxis: "month",
    });

    expect(option.series[0].itemStyle.color).toBe("#ff0000");
  });

  it("treats an unresolved string data placeholder as empty", () => {
    const option = buildBarChartOption({
      data: "{{ q_sales }}",
      series,
      xAxis: "month",
    });

    expect(option.series[0].data).toEqual([]);
  });
});
