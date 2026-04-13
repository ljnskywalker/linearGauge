import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
/**
 * Gauge Settings Card
 */
declare class GaugeSettingsCard extends FormattingSettingsCard {
    orientation: formattingSettings.ItemDropdown;
    showLabels: formattingSettings.ToggleSwitch;
    valueLabelPosition: formattingSettings.ItemDropdown;
    showCategoryLabel: formattingSettings.ToggleSwitch;
    valueFormat: formattingSettings.ItemDropdown;
    animationDuration: formattingSettings.NumUpDown;
    layout: formattingSettings.ItemDropdown;
    gaugeWidth: formattingSettings.NumUpDown;
    gaugePadding: formattingSettings.NumUpDown;
    fillThicknessFactor: formattingSettings.NumUpDown;
    useStaticValueColor: formattingSettings.ToggleSwitch;
    staticValueColor: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
/**
 * Color Zones Settings Card
 */
declare class ColorZonesCard extends FormattingSettingsCard {
    thresholdMode: formattingSettings.ItemDropdown;
    threshold1: formattingSettings.NumUpDown;
    threshold2: formattingSettings.NumUpDown;
    threshold3: formattingSettings.NumUpDown;
    threshold4: formattingSettings.NumUpDown;
    redColor: formattingSettings.ColorPicker;
    yellowColor: formattingSettings.ColorPicker;
    greenColor: formattingSettings.ColorPicker;
    lightBlueColor: formattingSettings.ColorPicker;
    showThresholdLabels: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
    populateSlices(): void;
}
/**
 * Target Settings Card
 */
declare class TargetSettingsCard extends FormattingSettingsCard {
    showTarget: formattingSettings.ToggleSwitch;
    targetColor: formattingSettings.ColorPicker;
    showComparison: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
/**
 * Category Layout Settings Card
 */
declare class CategoryLayoutCard extends FormattingSettingsCard {
    categoryFontSize: formattingSettings.NumUpDown;
    categoryPosition: formattingSettings.ItemDropdown;
    categoryTextColor: formattingSettings.ColorPicker;
    categoryPadding: formattingSettings.NumUpDown;
    categoryBold: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
/**
* visual settings model class
*
*/
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    gaugeSettings: GaugeSettingsCard;
    colorZones: ColorZonesCard;
    targetSettings: TargetSettingsCard;
    categoryLayout: CategoryLayoutCard;
    cards: (GaugeSettingsCard | ColorZonesCard | TargetSettingsCard | CategoryLayoutCard)[];
}
export {};
