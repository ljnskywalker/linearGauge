# Linear Gauge (Power BI Custom Visual)

Custom Power BI visual.

## Build Package (.pbiviz)

```bash
npm run package
```

Output is created in the `dist/` folder.

## Import Into Power BI Desktop

1. Open Power BI Desktop.
2. In the Visualizations pane, select the ellipsis (`...`).
3. Choose **Get more visuals** > **Import a visual from a file**.
4. Select the `.pbiviz` file from `dist/`.
5. Add the visual to your report and bind fields.

## Phase 2 UX and Accessibility Settings

In the format pane, use **Accessibility & Density** to tune high-density layouts and readability:

- **Enable Compact Mode**: reduces spacing so more gauges fit in the viewport.
- **Hide Secondary Text**: hides category/comparison/secondary label content for dense scenarios.
- **Turn Off Animations**: disables transitions for performance and reduced motion preference.
- **Minimum Label Font Size**: enforces a readable floor across label types.
- **Keyboard Focus Ring Color**: customizes visible keyboard focus outline.

## Phase 3 Analytics Settings

Use **Analytics** in the format pane for trend and target-state insights:

- **Show Trend Indicator**: compares current value to the optional **Previous Value** field.
- **Trend Display**: show delta, percent change, or both.
- **Trend Position**: place trend text on top, right, bottom, or left.
- **Trend Colors and Font**: configure positive, negative, and neutral states.
- **Show Target Bands**: classify value as Below, Near, or Above target using tolerance.
- **Target Tolerance (%)**: defines the Near band around target.
- **Band Colors/Labels**: set visual color and displayed label for Below/Near/Above states.

Deterministic target-band boundaries:

- Below: value < target - tolerance
- Near: target - tolerance <= value <= target + tolerance
- Above: value > target + tolerance

