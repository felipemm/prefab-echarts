import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";
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

import {
  buildBarChartOption,
  buildLineChartOption,
  buildPieChartOption,
  buildRadarChartOption,
  buildRadialChartOption,
  buildScatterChartOption,
  type BarChartOptionArgs,
  type LineChartOptionArgs,
  type PieChartOptionArgs,
  type RadarChartOptionArgs,
  type RadialChartOptionArgs,
  type ScatterChartOptionArgs,
} from "./option";

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

type AnyArgs = Record<string, unknown> & { series?: unknown };

/** Render any option through ECharts' server-side SVG renderer — no DOM. */
function renderSvg(option: object): string {
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: 600,
    height: 320,
  });
  chart.setOption(option as never);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

describe("ECharts bar chart — value labels", () => {
  it("draws a value label for every series point when showLabels is on", () => {
    const svg = renderSvg(
      buildBarChartOption({
        data,
        series,
        xAxis: "month",
        showLabels: true,
      } as BarChartOptionArgs),
    );

    for (const value of ["137", "42", "289", "63"]) {
      expect(svg).toContain(`>${value}<`);
    }
  });

  it("omits value labels when showLabels is off", () => {
    const svg = renderSvg(
      buildBarChartOption({ data, series, xAxis: "month" }),
    );

    expect(svg).not.toContain(">137<");
    expect(svg).not.toContain(">289<");
  });

  it("renders the category axis", () => {
    const svg = renderSvg(
      buildBarChartOption({ data, series, xAxis: "month" }),
    );

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

    expect(option.series.map((s) => s.itemStyle.color)).toEqual([
      "var(--color-chart-1)",
      "var(--color-chart-2)",
    ]);
  });

  it("uses the supplied palette rather than the CSS variables", () => {
    // The React layer resolves the palette to parseable colours before the
    // option is built; an unresolved `oklch()`/`var()` reaching ECharts makes
    // elements vanish on hover.
    const option = buildBarChartOption({ data, series, xAxis: "month" }, [
      "#111111",
      "#222222",
    ]);

    expect(option.series.map((s) => s.itemStyle.color)).toEqual([
      "#111111",
      "#222222",
    ]);
  });

  it("treats an unresolved string data placeholder as empty", () => {
    const option = buildBarChartOption({
      data: "{{ q_sales }}",
      series,
      xAxis: "month",
    });

    expect(option.series[0].data).toEqual([]);
  });

  it("uses ECharts 6 outer bounds rather than the deprecated containLabel", () => {
    const option = buildBarChartOption({ data, series, xAxis: "month" });

    expect(option.grid).not.toHaveProperty("containLabel");
    expect(option.grid).toMatchObject({
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    });
  });
});

describe("ECharts line and area charts", () => {
  it("renders a line with value labels", () => {
    const svg = renderSvg(
      buildLineChartOption({
        data,
        series,
        xAxis: "month",
        showLabels: true,
      }),
    );

    expect(svg).toContain("Jan");
    for (const value of ["137", "289"]) {
      expect(svg).toContain(`>${value}<`);
    }
  });

  it("omits value labels when showLabels is off", () => {
    const svg = renderSvg(
      buildLineChartOption({ data, series, xAxis: "month" }),
    );

    expect(svg).not.toContain(">137<");
  });

  it("maps curve names onto ECharts smooth/step", () => {
    const smooth = buildLineChartOption({
      data,
      series,
      xAxis: "month",
      curve: "smooth",
    });
    const step = buildLineChartOption({
      data,
      series,
      xAxis: "month",
      curve: "step",
    });
    const linear = buildLineChartOption({
      data,
      series,
      xAxis: "month",
    });

    expect(smooth.series[0].smooth).toBe(true);
    expect(step.series[0].step).toBe("middle");
    expect(linear.series[0].smooth).toBe(false);
    expect(linear.series[0].step).toBeUndefined();
  });

  it("only fills and stacks in area mode", () => {
    const line = buildLineChartOption({ data, series, xAxis: "month" });
    const area = buildLineChartOption({
      data,
      series,
      xAxis: "month",
      area: true,
      stacked: true,
    });

    expect(line.series[0].areaStyle).toBeUndefined();
    expect(area.series[0].areaStyle).toMatchObject({ opacity: 0.4 });
    expect(area.series.map((s) => s.stack)).toEqual(["total", "total"]);
  });

  it("shows symbols only when showDots is set", () => {
    const off = buildLineChartOption({ data, series, xAxis: "month" });
    const on = buildLineChartOption({
      data,
      series,
      xAxis: "month",
      showDots: true,
    });

    expect(off.series[0].showSymbol).toBe(false);
    expect(on.series[0].showSymbol).toBe(true);
  });

  it("forces symbols on when labels are requested", () => {
    // ECharts drops line labels entirely when showSymbol is false, so the
    // labels would otherwise disappear with no warning.
    const labelled = buildLineChartOption({
      data,
      series,
      xAxis: "month",
      showLabels: true,
    });

    expect(labelled.series[0].showSymbol).toBe(true);
  });
});

describe("ECharts pie chart", () => {
  const pieData = [
    { name: "A", value: 137 },
    { name: "B", value: 42 },
  ];

  it("renders slice names", () => {
    const svg = renderSvg(
      buildPieChartOption({
        data: pieData,
        dataKey: "value",
        nameKey: "name",
      }),
    );

    expect(svg).toContain("A");
    expect(svg).toContain("B");
  });

  it("draws slice values when showLabel is on", () => {
    const svg = renderSvg(
      buildPieChartOption({
        data: pieData,
        dataKey: "value",
        nameKey: "name",
        showLabel: true,
      }),
    );

    expect(svg).toContain(">137<");
    expect(svg).toContain(">42<");
  });

  it("maps innerRadius to a percentage and shrinks when labelled", () => {
    const plain = buildPieChartOption({
      data: pieData,
      dataKey: "value",
      nameKey: "name",
      innerRadius: 30,
    });
    const labelled = buildPieChartOption({
      data: pieData,
      dataKey: "value",
      nameKey: "name",
      innerRadius: 30,
      showLabel: true,
    });

    expect(plain.series[0].radius).toEqual(["24%", "80%"]);
    expect(labelled.series[0].radius).toEqual(["18%", "60%"]);
  });

  it("passes paddingAngle through as padAngle", () => {
    const option = buildPieChartOption({
      data: pieData,
      dataKey: "value",
      nameKey: "name",
      paddingAngle: 3,
    });

    expect(option.series[0].padAngle).toBe(3);
  });
});

describe("ECharts radar chart", () => {
  const radarData = [
    { axis: "Speed", a: 137, b: 42 },
    { axis: "Power", a: 289, b: 63 },
  ];
  const radarSeries = [{ dataKey: "a" }, { dataKey: "b" }];

  it("builds one indicator per row from the axis key", () => {
    const option = buildRadarChartOption({
      data: radarData,
      series: radarSeries,
      axisKey: "axis",
    });

    expect(option.radar.indicator.map((i) => i.name)).toEqual([
      "Speed",
      "Power",
    ]);
    expect(option.radar.indicator.every((i) => i.max >= 289)).toBe(true);
  });

  it("transposes rows into per-series value arrays", () => {
    const option = buildRadarChartOption({
      data: radarData,
      series: radarSeries,
      axisKey: "axis",
    });

    expect(option.series[0].data[0].value).toEqual([137, 289]);
    expect(option.series[0].data[1].value).toEqual([42, 63]);
  });

  it("renders axis names", () => {
    const svg = renderSvg(
      buildRadarChartOption({
        data: radarData,
        series: radarSeries,
        axisKey: "axis",
      }),
    );

    expect(svg).toContain("Speed");
    expect(svg).toContain("Power");
  });

  it("fills only when filled", () => {
    const filled = buildRadarChartOption({
      data: radarData,
      series: radarSeries,
      axisKey: "axis",
    });
    const hollow = buildRadarChartOption({
      data: radarData,
      series: radarSeries,
      axisKey: "axis",
      filled: false,
    });

    expect(filled.series[0].data[0].areaStyle).toMatchObject({ opacity: 0.3 });
    expect(hollow.series[0].data[0].areaStyle).toBeUndefined();
  });
});

describe("ECharts radial chart", () => {
  const radialData = [
    { name: "A", value: 137 },
    { name: "B", value: 42 },
  ];

  it("builds concentric rings: one angle category, one radius per entry", () => {
    const option = buildRadialChartOption({
      data: radialData,
      dataKey: "value",
      nameKey: "name",
    });

    expect(option.angleAxis.data).toEqual([""]);
    expect(option.radiusAxis.data).toEqual(["A", "B"]);
    expect(option.series[0].data).toHaveLength(2);
  });

  it("converts Recharts angles to ECharts angles", () => {
    // Recharts measures from 3 o'clock, ECharts from 12 o'clock.
    const option = buildRadialChartOption({
      data: radialData,
      dataKey: "value",
      nameKey: "name",
      startAngle: 180,
      endAngle: 0,
    });

    expect(option.polar.startAngle).toBe(270);
    expect(option.polar.endAngle).toBe(90);
  });

  it("scales innerRadius as a percentage", () => {
    const option = buildRadialChartOption({
      data: radialData,
      dataKey: "value",
      nameKey: "name",
      innerRadius: 30,
    });

    expect(option.polar.radius).toEqual(["30%", "80%"]);
  });

  it("renders without throwing", () => {
    const svg = renderSvg(
      buildRadialChartOption({
        data: radialData,
        dataKey: "value",
        nameKey: "name",
      }),
    );

    expect(svg).toContain("<svg");
  });
});

describe("ECharts scatter chart", () => {
  const scatterData = [
    { x: 1, y: 137, z: 10 },
    { x: 2, y: 289, z: 40 },
  ];

  it("plots [x, y] pairs", () => {
    const option = buildScatterChartOption({
      data: scatterData,
      series: [{ dataKey: "y" }],
      xAxis: "x",
      yAxis: "y",
    });

    expect(option.series[0].data).toEqual([
      [1, 137],
      [2, 289],
    ]);
  });

  it("adds the z value as a third element when a z axis is given", () => {
    const option = buildScatterChartOption({
      data: scatterData,
      series: [{ dataKey: "y" }],
      xAxis: "x",
      yAxis: "y",
      zAxis: "z",
    });

    expect(option.series[0].data[0]).toEqual([1, 137, 10]);
    const size = option.series[0].symbolSize as (v: unknown) => number;
    expect(size([1, 137, 0])).toBeLessThan(size([1, 137, 40]));
  });

  it("splits rows per series on the _series marker when there is more than one", () => {
    const option = buildScatterChartOption({
      data: [
        { x: 1, y: 10, _series: "a" },
        { x: 2, y: 20, _series: "b" },
      ],
      series: [{ dataKey: "a" }, { dataKey: "b" }],
      xAxis: "x",
      yAxis: "y",
    });

    expect(option.series[0].data).toEqual([[1, 10]]);
    expect(option.series[1].data).toEqual([[2, 20]]);
  });

  it("renders without throwing", () => {
    const svg = renderSvg(
      buildScatterChartOption({
        data: scatterData,
        series: [{ dataKey: "y" }],
        xAxis: "x",
        yAxis: "y",
      }),
    );

    expect(svg).toContain("<svg");
  });
});
