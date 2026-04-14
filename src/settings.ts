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
        value: 10
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
    displayName: string = "Gauge Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.orientation,
        this.showCategoryLabel,
        this.animationDuration,
        this.layout,
        this.gaugeWidth,
        this.gaugePadding,
        this.fillThicknessFactor,
        this.useStaticValueColor,
        this.staticValueColor
    ];
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
        displayName: "Red Color",
        value: { value: "#d32f2f" }  // Red
    });

    yellowColor = new formattingSettings.ColorPicker({
        name: "yellowColor",
        displayName: "Yellow Color",
        value: { value: "#fdd835" }  // Yellow
    });

    greenColor = new formattingSettings.ColorPicker({
        name: "greenColor",
        displayName: "Green Color",
        value: { value: "#4caf50" }  // Green
    });

    lightBlueColor = new formattingSettings.ColorPicker({
        name: "lightBlueColor",
        displayName: "Light Blue Color",
        value: { value: "#42a5f5" }  // Light Blue
    });

    showThresholdLabels = new formattingSettings.ToggleSwitch({
        name: "showThresholdLabels",
        displayName: "Show Threshold Values",
        value: true
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

    name: string = "colorZones";
    displayName: string = "Color Zones";
    slices: Array<FormattingSettingsSlice> = [
        this.thresholdMode,
        this.redColor,
        this.yellowColor,
        this.greenColor,
        this.lightBlueColor,
        this.showThresholdLabels,
        this.thresholdFontSize,
        this.thresholdFontFamily,
        this.thresholdDecimalPlaces,
        this.thresholdLabelColor,
        this.thresholdBold,
        this.thresholdItalic
    ];
    
    // Populate slices dynamically based on threshold mode
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
        
        // Show threshold labels toggle and formatting
        slices.push(this.showThresholdLabels);
        slices.push(this.thresholdFontSize);
        slices.push(this.thresholdFontFamily);
        slices.push(this.thresholdDecimalPlaces);
        slices.push(this.thresholdLabelColor);
        slices.push(this.thresholdBold);
        slices.push(this.thresholdItalic);
        
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

    name: string = "targetSettings";
    displayName: string = "Target Settings";
    slices: Array<FormattingSettingsSlice> = [this.showTarget, this.targetColor, this.showComparison];
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
    displayName: string = "Category & Layout";
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
        displayName: "Value Format",
        items: [
            { value: "decimal", displayName: "Decimal" },
            { value: "percentage", displayName: "Percentage" }
        ],
        value: { value: "decimal", displayName: "Decimal" }
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
    displayName: string = "Value Label Formatting";
    slices: Array<FormattingSettingsSlice> = [
        this.showLabels,
        this.valueLabelPosition,
        this.valueFormat,
        this.valueDecimalPlaces,
        this.valuePrefix,
        this.valueSuffix,
        this.valueFontSize,
        this.valueFontFamily,
        this.valueLabelColor,
        this.valueBold,
        this.valueItalic
    ];
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

    cards = [this.gaugeSettings, this.valueFormatting, this.categoryLayout, this.colorZones, this.targetSettings];
}
