/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import powerbi from "powerbi-visuals-api";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Gauge Settings Card
 */
class GaugeSettingsCard extends FormattingSettingsCard {
    orientation = new formattingSettings.ItemDropdown({
        name: "orientation",
        displayName: "Orientation",
        items: [
            { value: "horizontal", displayName: "Horizontal" },
            { value: "vertical", displayName: "Vertical" }
        ],
        value: { value: "vertical", displayName: "Vertical" }
    });

    showCategoryLabel = new formattingSettings.ToggleSwitch({
        name: "showCategoryLabel",
        displayName: "Show Category Label",
        value: true
    });

    animationDuration = new formattingSettings.NumUpDown({
        name: "animationDuration",
        displayName: "Animation Duration (ms)",
        value: 800
    });

    layout = new formattingSettings.ItemDropdown({
        name: "layout",
        displayName: "Layout",
        items: [
            { value: "horizontal", displayName: "Horizontal Row" }
        ],
        value: { value: "horizontal", displayName: "Horizontal Row" }
    });

    gaugeWidth = new formattingSettings.NumUpDown({
        name: "gaugeWidth",
        displayName: "Gauge Width (px)",
        value: 260
    });

    gaugePadding = new formattingSettings.NumUpDown({
        name: "gaugePadding",
        displayName: "Spacing Between Gauges (px)",
        value: 0
    });

    fillThicknessFactor = new formattingSettings.NumUpDown({
        name: "fillThicknessFactor",
        displayName: "Value Fill Thickness (%)",
        value: 50
    });

    useStaticValueColor = new formattingSettings.ToggleSwitch({
        name: "useStaticValueColor",
        displayName: "Use Static Value Color",
        value: false
    });

    staticValueColor = new formattingSettings.ColorPicker({
        name: "staticValueColor",
        displayName: "Static Value Color",
        value: { value: "#2f2f2f" }
    });

    name: string = "gaugeSettings";
    displayName: string = "Core Layout";
    slices: Array<FormattingSettingsSlice> = [
        this.orientation,
        this.layout,
        this.gaugeWidth,
        this.gaugePadding,
        this.fillThicknessFactor,
        this.showCategoryLabel,
        this.useStaticValueColor,
        this.staticValueColor,
        this.animationDuration
    ];

    // Keep controls contextual so commonly used layout settings remain easy to scan.
    populateSlices() {
        const slices: Array<FormattingSettingsSlice> = [
            this.orientation,
            this.layout,
            this.gaugeWidth,
            this.gaugePadding,
            this.fillThicknessFactor,
            this.showCategoryLabel,
            this.useStaticValueColor
        ];

        if (this.useStaticValueColor.value) {
            slices.push(this.staticValueColor);
        }

        slices.push(this.animationDuration);
        this.slices = slices;
    }
}

/**
 * Color Zones Settings Card
 */
class ColorZonesCard extends FormattingSettingsCard {
    thresholdMode = new formattingSettings.ItemDropdown({
        name: "thresholdMode",
        displayName: "Threshold Mode",
        items: [
            { value: "percentage", displayName: "Percentage" },
            { value: "absolute", displayName: "Absolute Values" }
        ],
        value: { value: "absolute", displayName: "Absolute Values" }
    });

    threshold1 = new formattingSettings.NumUpDown({
        name: "threshold1",
        displayName: "Red/Yellow Threshold",
        value: 20
    });

    threshold2 = new formattingSettings.NumUpDown({
        name: "threshold2",
        displayName: "Yellow/Green Threshold",
        value: 40
    });

    threshold3 = new formattingSettings.NumUpDown({
        name: "threshold3",
        displayName: "Green/Light Blue Threshold",
        value: 60
    });

    threshold4 = new formattingSettings.NumUpDown({
        name: "threshold4",
        displayName: "Light Blue Upper Threshold",
        value: 80
    });

    redColor = new formattingSettings.ColorPicker({
        name: "redColor",
        displayName: "Threshold 1 Color",
        value: { value: "#d32f2f" }  // Red
    });

    yellowColor = new formattingSettings.ColorPicker({
        name: "yellowColor",
        displayName: "Threshold 2 Color",
        value: { value: "#fdd835" }  // Yellow
    });

    greenColor = new formattingSettings.ColorPicker({
        name: "greenColor",
        displayName: "Threshold 3 Color",
        value: { value: "#4caf50" }  // Green
    });

    lightBlueColor = new formattingSettings.ColorPicker({
        name: "lightBlueColor",
        displayName: "Threshold 4 Color",
        value: { value: "#42a5f5" }  // Light Blue
    });

    showThresholdLabels = new formattingSettings.ToggleSwitch({
        name: "showThresholdLabels",
        displayName: "Show Threshold Values",
        value: true
    });

    showThreshold1Label = new formattingSettings.ToggleSwitch({
        name: "showThreshold1Label",
        displayName: "Show Threshold 1 Label",
        value: true
    });

    showThreshold2Label = new formattingSettings.ToggleSwitch({
        name: "showThreshold2Label",
        displayName: "Show Threshold 2 Label",
        value: true
    });

    showThreshold3Label = new formattingSettings.ToggleSwitch({
        name: "showThreshold3Label",
        displayName: "Show Threshold 3 Label",
        value: true
    });

    showThreshold4Label = new formattingSettings.ToggleSwitch({
        name: "showThreshold4Label",
        displayName: "Show Threshold 4 Label",
        value: true
    });

    scaleLabelDisplay = new formattingSettings.ItemDropdown({
        name: "scaleLabelDisplay",
        displayName: "Scale End Labels",
        items: [
            { value: "off", displayName: "Off" },
            { value: "min", displayName: "Min Only" },
            { value: "max", displayName: "Max Only" },
            { value: "both", displayName: "Both" }
        ],
        value: { value: "both", displayName: "Both" }
    });

    thresholdFontSize = new formattingSettings.NumUpDown({
        name: "thresholdFontSize",
        displayName: "Threshold Font Size",
        value: 10
    });

    thresholdFontFamily = new formattingSettings.FontPicker({
        name: "thresholdFontFamily",
        displayName: "Threshold Font Family",
        value: "Segoe UI, sans-serif"
    });

    thresholdDecimalPlaces = new formattingSettings.NumUpDown({
        name: "thresholdDecimalPlaces",
        displayName: "Threshold Decimal Places",
        value: 0
    });

    thresholdLabelColor = new formattingSettings.ColorPicker({
        name: "thresholdLabelColor",
        displayName: "Threshold Label Color",
        value: { value: "#666666" }
    });

    thresholdBold = new formattingSettings.ToggleSwitch({
        name: "thresholdBold",
        displayName: "Threshold Label Bold",
        value: false
    });

    thresholdItalic = new formattingSettings.ToggleSwitch({
        name: "thresholdItalic",
        displayName: "Threshold Label Italic",
        value: false
    });

    thresholdMaxLabelLength = new formattingSettings.NumUpDown({
        name: "thresholdMaxLabelLength",
        displayName: "Max Threshold Label Length",
        value: 8
    });

    thresholdLineStyle = new formattingSettings.ItemDropdown({
        name: "thresholdLineStyle",
        displayName: "Threshold Line Style",
        items: [
            { value: "solid", displayName: "Solid" },
            { value: "dashed", displayName: "Dashed" },
            { value: "dotted", displayName: "Dotted" }
        ],
        value: { value: "solid", displayName: "Solid" }
    });

    name: string = "colorZones";
    displayName: string = "Scale & Thresholds";
    slices: Array<FormattingSettingsSlice> = [
        this.thresholdMode,
        this.threshold1,
        this.threshold2,
        this.threshold3,
        this.threshold4,
        this.redColor,
        this.yellowColor,
        this.greenColor,
        this.lightBlueColor,
        this.showThresholdLabels,
        this.showThreshold1Label,
        this.showThreshold2Label,
        this.showThreshold3Label,
        this.showThreshold4Label,
        this.scaleLabelDisplay,
        this.thresholdMaxLabelLength,
        this.thresholdLineStyle,
        this.thresholdFontSize,
        this.thresholdFontFamily,
        this.thresholdDecimalPlaces,
        this.thresholdLabelColor,
        this.thresholdBold,
        this.thresholdItalic
    ];
    
    // Populate slices dynamically based on threshold and label modes.
    populateSlices() {
        const slices: Array<FormattingSettingsSlice> = [this.thresholdMode];
        
        // Only show threshold inputs in percentage mode
        if (this.thresholdMode.value.value === "percentage") {
            slices.push(this.threshold1);
            slices.push(this.threshold2);
            slices.push(this.threshold3);
            slices.push(this.threshold4);
        }
        
        // Always show color pickers
        slices.push(this.redColor);
        slices.push(this.yellowColor);
        slices.push(this.greenColor);
        slices.push(this.lightBlueColor);
        
        slices.push(this.scaleLabelDisplay);

        // Show threshold labels toggle and related formatting only when labels are enabled.
        slices.push(this.showThresholdLabels);
        if (this.showThresholdLabels.value) {
            slices.push(this.showThreshold1Label);
            slices.push(this.showThreshold2Label);
            slices.push(this.showThreshold3Label);
            slices.push(this.showThreshold4Label);
            slices.push(this.thresholdMaxLabelLength);
            slices.push(this.thresholdLineStyle);
            slices.push(this.thresholdFontSize);
            slices.push(this.thresholdFontFamily);
            slices.push(this.thresholdDecimalPlaces);
            slices.push(this.thresholdLabelColor);
            slices.push(this.thresholdBold);
            slices.push(this.thresholdItalic);
        }
        
        this.slices = slices;
    }
}

/**
 * Target Settings Card
 */
class TargetSettingsCard extends FormattingSettingsCard {
    showTarget = new formattingSettings.ToggleSwitch({
        name: "showTarget",
        displayName: "Show Target Marker",
        value: true
    });

    targetColor = new formattingSettings.ColorPicker({
        name: "targetColor",
        displayName: "Target Color",
        value: { value: "#000000" }
    });

    showComparison = new formattingSettings.ToggleSwitch({
        name: "showComparison",
        displayName: "Show Comparison",
        value: false
    });

    comparisonDisplay = new formattingSettings.ItemDropdown({
        name: "comparisonDisplay",
        displayName: "Comparison Display",
        items: [
            { value: "off", displayName: "Off" },
            { value: "absolute", displayName: "Absolute Delta" },
            { value: "percent", displayName: "Percent Delta" },
            { value: "both", displayName: "Both" }
        ],
        value: { value: "both", displayName: "Both" }
    });

    comparisonPosition = new formattingSettings.ItemDropdown({
        name: "comparisonPosition",
        displayName: "Comparison Position",
        items: [
            { value: "top", displayName: "Top" },
            { value: "left", displayName: "Left" },
            { value: "right", displayName: "Right" },
            { value: "bottom", displayName: "Bottom" }
        ],
        value: { value: "bottom", displayName: "Bottom" }
    });

    comparisonPositiveColor = new formattingSettings.ColorPicker({
        name: "comparisonPositiveColor",
        displayName: "Positive Comparison Color",
        value: { value: "#0b6a0b" }
    });

    comparisonNegativeColor = new formattingSettings.ColorPicker({
        name: "comparisonNegativeColor",
        displayName: "Negative Comparison Color",
        value: { value: "#a20d18" }
    });

    comparisonFontSize = new formattingSettings.NumUpDown({
        name: "comparisonFontSize",
        displayName: "Comparison Font Size",
        value: 12
    });

    comparisonFontFamily = new formattingSettings.FontPicker({
        name: "comparisonFontFamily",
        displayName: "Comparison Font Family",
        value: "Segoe UI, sans-serif"
    });

    comparisonBold = new formattingSettings.ToggleSwitch({
        name: "comparisonBold",
        displayName: "Comparison Bold",
        value: true
    });

    comparisonItalic = new formattingSettings.ToggleSwitch({
        name: "comparisonItalic",
        displayName: "Comparison Italic",
        value: false
    });

    name: string = "targetSettings";
    displayName: string = "Target & Comparison";
    slices: Array<FormattingSettingsSlice> = [
        this.showTarget,
        this.targetColor,
        this.showComparison,
        this.comparisonDisplay,
        this.comparisonPosition,
        this.comparisonPositiveColor,
        this.comparisonNegativeColor,
        this.comparisonFontSize,
        this.comparisonFontFamily,
        this.comparisonBold,
        this.comparisonItalic
    ];

    populateSlices() {
        const slices: Array<FormattingSettingsSlice> = [this.showTarget];

        if (this.showTarget.value) {
            slices.push(this.targetColor);
        }

        slices.push(this.showComparison);
        if (this.showComparison.value) {
            slices.push(this.comparisonDisplay);
            slices.push(this.comparisonPosition);
            slices.push(this.comparisonPositiveColor);
            slices.push(this.comparisonNegativeColor);
            slices.push(this.comparisonFontSize);
            slices.push(this.comparisonFontFamily);
            slices.push(this.comparisonBold);
            slices.push(this.comparisonItalic);
        }

        this.slices = slices;
    }
}

/**
 * Category Layout Settings Card
 */
class CategoryLayoutCard extends FormattingSettingsCard {
    categoryFontSize = new formattingSettings.NumUpDown({
        name: "categoryFontSize",
        displayName: "Category Font Size (px)",
        value: 16
    });

    categoryPosition = new formattingSettings.ItemDropdown({
        name: "categoryPosition",
        displayName: "Category Position",
        items: [
            { value: "top-left", displayName: "Top Left" },
            { value: "top-center", displayName: "Top Center" },
            { value: "top-right", displayName: "Top Right" },
            { value: "bottom-center", displayName: "Bottom Center" },
            { value: "bottom-angled-45", displayName: "Bottom Angled 45°" },
            { value: "left", displayName: "Left Side" }
        ],
        value: { value: "bottom-center", displayName: "Bottom Center" }
    });

    categoryTextColor = new formattingSettings.ColorPicker({
        name: "categoryTextColor",
        displayName: "Category Text Color",
        value: { value: "#333333" }
    });

    categoryPadding = new formattingSettings.NumUpDown({
        name: "categoryPadding",
        displayName: "Category Gap From Gauge (px)",
        value: 10
    });

    categoryBold = new formattingSettings.ToggleSwitch({
        name: "categoryBold",
        displayName: "Bold Category Text",
        value: true
    });

    name: string = "categoryLayout";
    displayName: string = "Category Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.categoryFontSize,
        this.categoryPosition,
        this.categoryTextColor,
        this.categoryBold,
        this.categoryPadding
    ];
}

/**
 * Value Formatting Settings Card
 */
class ValueFormattingCard extends FormattingSettingsCard {
    showLabels = new formattingSettings.ToggleSwitch({
        name: "showLabels",
        displayName: "Show Labels",
        value: true
    });

    valueLabelPosition = new formattingSettings.ItemDropdown({
        name: "valueLabelPosition",
        displayName: "Value Label Position",
        items: [
            { value: "left", displayName: "Left" },
            { value: "right", displayName: "Right" },
            { value: "top-center", displayName: "Middle Above Gauge" }
        ],
        value: { value: "right", displayName: "Right" }
    });

    valueFormat = new formattingSettings.ItemDropdown({
        name: "valueFormat",
        displayName: "Value Format Preset",
        items: [
            { value: "auto", displayName: "Auto" },
            { value: "number", displayName: "Number" },
            { value: "percent", displayName: "Percent" },
            { value: "currency", displayName: "Currency" },
            { value: "compact", displayName: "Compact" },
            { value: "decimal", displayName: "Decimal (Legacy)" },
            { value: "percentage", displayName: "Percentage (Legacy)" }
        ],
        value: { value: "auto", displayName: "Auto" }
    });

    valueDecimalPlaces = new formattingSettings.NumUpDown({
        name: "valueDecimalPlaces",
        displayName: "Decimal Places",
        value: 0
    });

    valuePrefix = new formattingSettings.TextInput({
        name: "valuePrefix",
        displayName: "Value Prefix",
        value: "",
        placeholder: "e.g., $"
    });

    valueSuffix = new formattingSettings.TextInput({
        name: "valueSuffix",
        displayName: "Value Suffix",
        value: "",
        placeholder: "e.g., units"
    });

    valueFontSize = new formattingSettings.NumUpDown({
        name: "valueFontSize",
        displayName: "Value Font Size",
        value: 14
    });

    valueFontFamily = new formattingSettings.FontPicker({
        name: "valueFontFamily",
        displayName: "Value Font Family",
        value: "Segoe UI, sans-serif"
    });

    valueLabelColor = new formattingSettings.ColorPicker({
        name: "valueLabelColor",
        displayName: "Value Label Color",
        value: { value: "#333333" }
    });

    valueBold = new formattingSettings.ToggleSwitch({
        name: "valueBold",
        displayName: "Value Label Bold",
        value: false
    });

    valueItalic = new formattingSettings.ToggleSwitch({
        name: "valueItalic",
        displayName: "Value Label Italic",
        value: false
    });

    name: string = "valueFormatting";
    displayName: string = "Value Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.showLabels,
        this.valueFormat,
        this.valueDecimalPlaces,
        this.valueLabelPosition,
        this.valuePrefix,
        this.valueSuffix,
        this.valueFontSize,
        this.valueFontFamily,
        this.valueLabelColor,
        this.valueBold,
        this.valueItalic
    ];

    populateSlices() {
        const slices: Array<FormattingSettingsSlice> = [
            this.showLabels,
            this.valueFormat,
            this.valueDecimalPlaces
        ];

        if (this.showLabels.value) {
            slices.push(this.valueLabelPosition);
            slices.push(this.valuePrefix);
            slices.push(this.valueSuffix);
            slices.push(this.valueFontSize);
            slices.push(this.valueFontFamily);
            slices.push(this.valueLabelColor);
            slices.push(this.valueBold);
            slices.push(this.valueItalic);
        }

        this.slices = slices;
    }
}

/**
 * Accessibility and high-density mode settings
 */
class UxAccessibilityCard extends FormattingSettingsCard {
    compactMode = new formattingSettings.ToggleSwitch({
        name: "compactMode",
        displayName: "Enable Compact Mode",
        value: false
    });

    hideSecondaryText = new formattingSettings.ToggleSwitch({
        name: "hideSecondaryText",
        displayName: "Hide Secondary Text",
        value: false
    });

    disableAnimations = new formattingSettings.ToggleSwitch({
        name: "disableAnimations",
        displayName: "Turn Off Animations",
        value: false
    });

    minLabelFontSize = new formattingSettings.NumUpDown({
        name: "minLabelFontSize",
        displayName: "Minimum Label Font Size",
        value: 10
    });

    focusRingColor = new formattingSettings.ColorPicker({
        name: "focusRingColor",
        displayName: "Keyboard Focus Ring Color",
        value: { value: "#005a9e" }
    });

    name: string = "uxAccessibility";
    displayName: string = "Accessibility & Density";
    slices: Array<FormattingSettingsSlice> = [
        this.compactMode,
        this.hideSecondaryText,
        this.disableAnimations,
        this.minLabelFontSize,
        this.focusRingColor
    ];
}

/**
 * Phase 3 analytics settings
 */
class AnalyticsCard extends FormattingSettingsCard {
    showTrendIndicator = new formattingSettings.ToggleSwitch({
        name: "showTrendIndicator",
        displayName: "Show Trend Indicator",
        value: false
    });

    trendDisplay = new formattingSettings.ItemDropdown({
        name: "trendDisplay",
        displayName: "Trend Display",
        items: [
            { value: "delta", displayName: "Delta" },
            { value: "percent", displayName: "Percent" },
            { value: "both", displayName: "Both" }
        ],
        value: { value: "both", displayName: "Both" }
    });

    trendPosition = new formattingSettings.ItemDropdown({
        name: "trendPosition",
        displayName: "Trend Position",
        items: [
            { value: "top", displayName: "Top" },
            { value: "right", displayName: "Right" },
            { value: "bottom", displayName: "Bottom" },
            { value: "left", displayName: "Left" }
        ],
        value: { value: "top", displayName: "Top" }
    });

    trendPositiveColor = new formattingSettings.ColorPicker({
        name: "trendPositiveColor",
        displayName: "Trend Positive Color",
        value: { value: "#0b6a0b" }
    });

    trendNegativeColor = new formattingSettings.ColorPicker({
        name: "trendNegativeColor",
        displayName: "Trend Negative Color",
        value: { value: "#a20d18" }
    });

    trendNeutralColor = new formattingSettings.ColorPicker({
        name: "trendNeutralColor",
        displayName: "Trend Neutral Color",
        value: { value: "#666666" }
    });

    trendFontSize = new formattingSettings.NumUpDown({
        name: "trendFontSize",
        displayName: "Trend Font Size",
        value: 11
    });

    trendFontFamily = new formattingSettings.FontPicker({
        name: "trendFontFamily",
        displayName: "Trend Font Family",
        value: "Segoe UI, sans-serif"
    });

    trendBold = new formattingSettings.ToggleSwitch({
        name: "trendBold",
        displayName: "Trend Bold",
        value: true
    });

    trendItalic = new formattingSettings.ToggleSwitch({
        name: "trendItalic",
        displayName: "Trend Italic",
        value: false
    });

    showTargetBands = new formattingSettings.ToggleSwitch({
        name: "showTargetBands",
        displayName: "Show Target Bands",
        value: false
    });

    targetBandTolerancePercent = new formattingSettings.NumUpDown({
        name: "targetBandTolerancePercent",
        displayName: "Target Tolerance (%)",
        value: 5
    });

    showTargetBandLabel = new formattingSettings.ToggleSwitch({
        name: "showTargetBandLabel",
        displayName: "Show Target Band Label",
        value: true
    });

    belowTargetColor = new formattingSettings.ColorPicker({
        name: "belowTargetColor",
        displayName: "Below Target Color",
        value: { value: "#f8d7da" }
    });

    nearTargetColor = new formattingSettings.ColorPicker({
        name: "nearTargetColor",
        displayName: "Near Target Color",
        value: { value: "#fff3cd" }
    });

    aboveTargetColor = new formattingSettings.ColorPicker({
        name: "aboveTargetColor",
        displayName: "Above Target Color",
        value: { value: "#d1e7dd" }
    });

    belowTargetLabel = new formattingSettings.TextInput({
        name: "belowTargetLabel",
        displayName: "Below Target Label",
        value: "Below",
        placeholder: "Below"
    });

    nearTargetLabel = new formattingSettings.TextInput({
        name: "nearTargetLabel",
        displayName: "Near Target Label",
        value: "Near",
        placeholder: "Near"
    });

    aboveTargetLabel = new formattingSettings.TextInput({
        name: "aboveTargetLabel",
        displayName: "Above Target Label",
        value: "Above",
        placeholder: "Above"
    });

    name: string = "analyticsSettings";
    displayName: string = "Analytics";
    slices: Array<FormattingSettingsSlice> = [
        this.showTrendIndicator,
        this.trendDisplay,
        this.trendPosition,
        this.trendPositiveColor,
        this.trendNegativeColor,
        this.trendNeutralColor,
        this.trendFontSize,
        this.trendFontFamily,
        this.trendBold,
        this.trendItalic,
        this.showTargetBands,
        this.targetBandTolerancePercent,
        this.showTargetBandLabel,
        this.belowTargetColor,
        this.nearTargetColor,
        this.aboveTargetColor,
        this.belowTargetLabel,
        this.nearTargetLabel,
        this.aboveTargetLabel
    ];

    populateSlices() {
        const slices: Array<FormattingSettingsSlice> = [this.showTrendIndicator];

        if (this.showTrendIndicator.value) {
            slices.push(this.trendDisplay);
            slices.push(this.trendPosition);
            slices.push(this.trendPositiveColor);
            slices.push(this.trendNegativeColor);
            slices.push(this.trendNeutralColor);
            slices.push(this.trendFontSize);
            slices.push(this.trendFontFamily);
            slices.push(this.trendBold);
            slices.push(this.trendItalic);
        }

        slices.push(this.showTargetBands);
        if (this.showTargetBands.value) {
            slices.push(this.targetBandTolerancePercent);
            slices.push(this.showTargetBandLabel);
            slices.push(this.belowTargetColor);
            slices.push(this.nearTargetColor);
            slices.push(this.aboveTargetColor);
            slices.push(this.belowTargetLabel);
            slices.push(this.nearTargetLabel);
            slices.push(this.aboveTargetLabel);
        }

        this.slices = slices;
    }
}

/**
* visual settings model class
*
*/

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    gaugeSettings = new GaugeSettingsCard();
    valueFormatting = new ValueFormattingCard();
    colorZones = new ColorZonesCard();
    targetSettings = new TargetSettingsCard();
    categoryLayout = new CategoryLayoutCard();
    uxAccessibility = new UxAccessibilityCard();
    analyticsSettings = new AnalyticsCard();

    cards = [
        this.gaugeSettings,
        this.categoryLayout,
        this.valueFormatting,
        this.colorZones,
        this.targetSettings,
        this.analyticsSettings,
        this.uxAccessibility
    ];
}
