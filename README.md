# Linear Gauge (Power BI Custom Visual)

Custom Power BI visual that renders linear gauges with support for thresholds, targets, comparison indicators, multiple layout modes, and horizontal/vertical orientations.

## Project Info

- Visual name: `linearGauge`
- GUID: `linearGauge16D5E17790E94862BEA55E4F2EE66BFE`
- Version: `1.1.0.0`
- API version: `5.3.0`

## Prerequisites

- Node.js (LTS recommended)
- npm
- Power BI Desktop (for importing and testing `.pbiviz`)

## Install

```bash
npm install
```

## Development

Start local visual development mode:

```bash
npm run start
```

## Lint

```bash
npm run lint
```

## Build Package (.pbiviz)

```bash
npm run package
```

Output is created in the `dist/` folder.

Example output file:

- `dist/linearGauge16D5E17790E94862BEA55E4F2EE66BFE.1.1.0.0.pbiviz`

## Import Into Power BI Desktop

1. Open Power BI Desktop.
2. In the Visualizations pane, select the ellipsis (`...`).
3. Choose **Get more visuals** > **Import a visual from a file**.
4. Select the `.pbiviz` file from `dist/`.
5. Add the visual to your report and bind fields.

## Notes for Sharing

- The `.pbiviz` contains visual code and default settings.
- Report-specific formatting and layout choices are saved in the `.pbix` report file, not in the `.pbiviz`.

## License

MIT
