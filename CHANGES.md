# Changes from upstream

This repository is a fork of [PrefectHQ/prefab](https://github.com/PrefectHQ/prefab)
(Apache-2.0). It replaces the renderer's Recharts-backed chart layer with an
ECharts-backed one, delivered as a small, re-appliable delta so upstream releases
can be rebased onto cheaply.

## Modified files

| File | Change |
| --- | --- |
| `renderer/package.json` | Adds `echarts`, pinned to an exact version. |
| `renderer/src/schemas/chart.ts` | Adds the optional `showLabels` wire property. |
| `renderer/vite.config.cdn.ts` | Aliases the single `./charts` specifier in `renderer/src/components/registry.ts` to `renderer/src/echarts/charts.tsx`. |

## Added files

| File | Purpose |
| --- | --- |
| `renderer/src/echarts/charts.tsx` | ECharts-backed drop-in for the chart components. Not-yet-ported charts are re-exported from upstream, so the layer can be ported one type at a time. |
| `renderer/src/echarts/option.ts` | Pure option builders, free of React so they are testable in a node environment. |
| `renderer/src/echarts/option.test.ts` | Tests, using ECharts' server-side SVG renderer. |

## Upstream baseline

Forked from tag `v0.20.2`. The renderer and the `prefab-ui` Python package must
stay **in lockstep**: the wire format is the contract between them, and a
mismatch fails silently rather than loudly.
