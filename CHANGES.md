# Changes from upstream

This repository is a fork of [PrefectHQ/prefab](https://github.com/PrefectHQ/prefab)
(Apache-2.0). It replaces the renderer's Recharts-backed chart layer with an
ECharts-backed one, delivered as a small, re-appliable delta so upstream releases
can be rebased onto cheaply.

## Modified files

| File | Change |
| --- | --- |
| `renderer/package.json` | Adds `echarts`, pinned to an exact version. |
| `renderer/src/schemas/chart.ts` | Adds the optional `showLabels` property to the shared cartesian wire schema (bar, line, area). |
| `renderer/vite.config.cdn.ts` | Aliases the single `./charts` specifier in `renderer/src/components/registry.ts` to `renderer/src/echarts/charts.tsx`. |
| `renderer/vite.config.bundled.ts` | The same alias, for the single-file build. |
| `renderer/src/components/registry.ts` | Comment-only: the chart entries no longer describe Recharts. |
| `src/prefab_ui/components/charts/__init__.py` | Adds `show_labels` to `BarChart`, `LineChart` and `AreaChart`. |
| `renderer/schemas/fixtures/components/{Bar,Line,Area}Chart.json` | Regenerated wire fixtures (see below). |

Recharts is still a declared dependency because upstream's `ui/chart.tsx` imports it,
but nothing in the chart path does any more, so it is tree-shaken out of every
build: the chart chunk went from 950 kB to 593 kB, and no Recharts identifier
appears in the output.

## Added files

| File | Purpose |
| --- | --- |
| `renderer/src/echarts/charts.tsx` | ECharts-backed components for bar, line, area, pie, radar, radial and scatter. `Sparkline` still comes from upstream — it never used Recharts. |
| `renderer/src/echarts/option.ts` | Pure option builders, free of React so they are testable in a node environment. |
| `renderer/src/echarts/option.test.ts` | Tests, using ECharts' server-side SVG renderer. |
| `Makefile` | Upgrade, verification and build targets. |
| `PREFAB_VERSION` | The upstream release this branch is based on. |

## Behaviours ECharts does differently

Two places where ECharts drops something silently, so the builders compensate and
say why in comments:

- **Line labels need symbols.** ECharts only draws line labels at symbols and
  discards them entirely when `showSymbol` is false, so requesting value labels
  forces symbols on. Upstream draws labels independently of the dots.
- **Default label text differs.** Bar labels default to the value, line and pie
  labels do not, so the builders pass the `{c}` value placeholder explicitly.

Angles also differ: Recharts measures them from 3 o'clock, ECharts from
12 o'clock, so the radial chart converts.

## Layout

| Branch | Contents |
| --- | --- |
| `echarts` (default) | The patch, based on upstream tag `v$(cat PREFAB_VERSION)`. |
| `main` | Pristine upstream, tracking `upstream/main`. |

## Upgrading

Do not merge upstream — rebase onto it:

```bash
make upgrade VERSION=0.20.3
```

That fetches tags, rebases `echarts`, records the pin, and runs the full check.
Conflicts are expected only in the files listed above.

## The renderer and `prefab-ui` stay in lockstep

The **wire format is the contract** between the Python package and the renderer.
A renderer built from one commit against a `prefab-ui` from another fails
**silently**, not loudly, so the relationship is checked rather than assumed.

Installing `prefab-ui` from this fork yields a dev version carrying the commit it
was built from, for example `0.20.3.dev5+6be8449`. That SHA — not the number — is
the thing to check:

```bash
make lockstep PREFAB_UI=0.20.3.dev5+6be8449
```

Consume both halves at the same commit — the Python package by pinning the git
URL, the renderer by building from that commit and serving it via
`PREFAB_RENDERER_URL`:

```toml
"prefab-ui @ git+https://github.com/<you>/prefab-echarts@<commit>"
```

Installing `prefab-ui` from PyPI is **not** equivalent: the published package has
no `showLabels` field, and because pydantic's default is `extra="ignore"`,
passing it would be dropped silently rather than raising.

## Adding a wire property

The wire schema is **generated from the Python models**, and both sides are
drift-checked. A property cannot be added by editing the TypeScript schema alone:

1. Add the field to the Python model in `src/prefab_ui/components/charts/`.
2. Add it to the Zod schema in `renderer/src/schemas/chart.ts`.
3. `make generate-schemas` — regenerates fixtures and the manifest.
4. `make check` — runs the Python contract tests, the renderer tests, the schema
   freshness check, and both builds.

Skipping step 3 fails `make schema-check`, and skipping step 1 means the property
exists in the wire but nothing can produce it — pydantic's default `extra="ignore"`
drops unknown arguments silently, so passing it would be a no-op rather than an error.

## Two renderer artifacts

| Artifact | Build | Consumed by |
| --- | --- | --- |
| `renderer/dist/app` | `make build-cdn` | `PREFAB_RENDERER_URL` — the normal path |
| `renderer/dist/bundled/index.html` | `make build-bundled` | Airgapped / bundled mode |

`make build` produces both into `renderer/dist`, which is gitignored. It does
**not** copy the bundled file over `src/prefab_ui/renderer/app.html`: that is a
tracked upstream file, and syncing it would add ~7 MB to the delta for a mode
this fork does not ship. Use `make sync-bundled` if you deliberately need it.

## Upstream baseline

Forked from tag `v0.20.2`. The patch is intentionally based on a release tag
rather than `main`, so the renderer always corresponds to a published
`prefab-ui` version.
