# Linear Gauge (Power BI Custom Visual)

The Linear Gauge visual is a compact KPI-style chart for tracking progress against targets across categories.
It is designed for report pages where users need to quickly compare current performance, threshold zones,
and goal attainment without the visual overhead of full chart scaffolding.

This visual renders one gauge per category and supports both horizontal and vertical orientations, making it
useful for dashboards, scorecards, and operational monitoring views.

## What This Visual Is Good For

- Monitoring progress toward targets for many entities (schools, regions, teams, products, etc.)
- Showing performance state with clear threshold color bands
- Comparing actual vs target with optional delta text
- Highlighting trend direction using optional previous-period values
- Preserving readability in dense layouts with accessibility-focused controls

## Key Capabilities

- Multiple gauges in a single visual, one per category
- Configurable color zones using percentage or absolute threshold modes
- Target markers and comparison display modes (absolute, percent, both)
- Value formatting presets and label styling controls
- Trend indicator support using optional Previous Value input
- Target bands with deterministic Below/Near/Above tolerance logic
- Keyboard focus support and contrast-aware behavior

## Data Roles

Use these fields in Power BI to drive the visual:

- **Category**: grouping field used to create one gauge per item
- **Value**: primary metric shown as the filled gauge value
- **Minimum**: lower bound of the gauge scale
- **Maximum**: upper bound of the gauge scale
- **Target**: optional goal marker for comparison
- **Threshold 1-4**: optional custom breakpoints for threshold zones
- **Previous Value**: optional prior-period value for trend analysis
- **Tooltip Value**: optional fields shown in tooltip on hover

## Formatting Areas

The format pane is organized for workflow-based editing:

- **Core Layout**
- **Category Labels**
- **Value Labels**
- **Scale & Thresholds**
- **Target & Comparison**
- **Analytics**
- **Accessibility & Density**

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

