/*
*  Power BI Visual CLI
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
/// <reference path="./style-modules.d.ts" />
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { createTooltipServiceWrapper, ITooltipServiceWrapper, TooltipEventArgs } from "powerbi-visuals-utils-tooltiputils";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import DataViewSingle = powerbi.DataViewSingle;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IColorPalette = powerbi.extensibility.IColorPalette;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;

import { VisualFormattingSettingsModel } from "./settings";

interface GaugeData {
    category: string | null;
    value: number;
    previousValue: number | null;
    minimum: number;
    maximum: number;
    target: number | null;
    threshold1: number | null;
    threshold2: number | null;
    threshold3: number | null;
    threshold4: number | null;
    customTooltips: VisualTooltipDataItem[];
    selectionId: ISelectionId | null;
    color: string;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private rootElement: HTMLElement;
    private scrollContainer: HTMLDivElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private container: d3.Selection<SVGGElement, unknown, null, undefined>;
    private formattingSettings!: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;
    private colorPalette!: IColorPalette;
    private allowInteractions: boolean = true;
    private isHighContrast: boolean = false;
    private highContrastColors: any;
    // Conditional formatting: bound reference to createDataViewWildcardSelector
    private readonly _createWildcardSelector = dataViewWildcard.createDataViewWildcardSelector.bind(dataViewWildcard);
    
    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.host = options.host;
        this.rootElement = options.element as HTMLElement;
        const localizationManager = options.host.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(localizationManager);
        this.selectionManager = options.host.createSelectionManager();

        // Dedicated scrolling wrapper to ensure scrollbars work inside Power BI host
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.style.width = '100%';
        this.scrollContainer.style.height = '100%';
        this.scrollContainer.style.overflowX = 'auto';
        this.scrollContainer.style.overflowY = 'auto';
        this.scrollContainer.style.padding = '0';
        this.scrollContainer.style.boxSizing = 'border-box';
        this.rootElement.appendChild(this.scrollContainer);
        
        // Create SVG element
        this.svg = d3.select(this.scrollContainer)
            .append('svg')
            .classed('linearGauge', true)
            .attr('tabindex', 0)  // Make SVG focusable for keyboard navigation
            .attr('role', 'img')
            .attr('aria-label', 'Linear Gauge Visualization');
        
        // Create container group for all gauge elements
        this.container = this.svg.append('g')
            .classed('container', true);
        
        // Initialize tooltip service
        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            options.host.tooltipService,
            options.element
        );

        // Clear selection when user clicks empty visual area
        this.svg.on('click', () => {
            if (this.allowInteractions) {
                this.selectionManager.clear();
            }
        });

        // Handle context menu on empty space
        this.svg.on('contextmenu', (event: PointerEvent) => {
            if (this.allowInteractions) {
                this.selectionManager.showContextMenu({}, {
                    x: event.clientX,
                    y: event.clientY
                });
                event.preventDefault();
            }
        });

        // Add keyboard navigation support
        this.svg.on('keydown', (event: KeyboardEvent) => {
            if (!this.allowInteractions) return;
            
            // Handle Enter or Space to toggle selection
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                // Future: navigate between gauge items
            }
            
            // Handle Escape to clear selection
            if (event.key === 'Escape') {
                event.preventDefault();
                this.selectionManager.clear();
            }
        });

        this.svg.on('focusin', () => {
            this.svg.classed('keyboard-focus', true);
        });

        this.svg.on('focusout', () => {
            this.svg.classed('keyboard-focus', false);
        });
    }

    public update(options: VisualUpdateOptions) {
        try {
            this.host.eventService?.renderingStarted(options);

            const updateOptions = options as VisualUpdateOptions & { allowInteractions?: boolean };
            this.allowInteractions = updateOptions.allowInteractions !== false;

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews?.[0]
            );

            this.colorPalette = this.host.colorPalette;
            const palette = this.colorPalette as any;
            this.isHighContrast = !!palette.isHighContrast;
            if (this.isHighContrast) {
                this.highContrastColors = {
                    foreground: palette.foreground?.value || "#000000",
                    background: palette.background?.value || "#ffffff",
                    foregroundSelected: palette.foregroundSelected?.value || palette.foreground?.value || "#000000",
                    hyperlink: palette.hyperlink?.value || palette.foreground?.value || "#000000"
                };
            }

            this.formattingSettings.gaugeSettings.populateSlices();
            this.formattingSettings.valueFormatting.populateSlices();
            this.formattingSettings.colorZones.populateSlices();
            this.formattingSettings.targetSettings.populateSlices();
            this.formattingSettings.analyticsSettings.populateSlices();

            const focusRingColor = this.formattingSettings.uxAccessibility.focusRingColor.value.value;
            this.svg.style('outline-color', focusRingColor);
            this.svg.classed('compact-mode', this.formattingSettings.uxAccessibility.compactMode.value);
            this.svg.classed('no-motion', this.formattingSettings.uxAccessibility.disableAnimations.value);

            const width = options.viewport.width;
            const height = options.viewport.height;

            const dataView = options.dataViews?.[0];
            if (!dataView) {
                this.renderNoDataState(width, height);
                this.host.eventService?.renderingFinished(options);
                return;
            }

            const gaugeDataArray = this.extractData(dataView);
            if (!gaugeDataArray || gaugeDataArray.length === 0) {
                this.renderNoDataState(width, height);
                this.host.eventService?.renderingFinished(options);
                return;
            }

            this.applyRootAriaLabel(gaugeDataArray);
            this.renderMultipleGauges(gaugeDataArray, width, height);

            this.host.eventService?.renderingFinished(options);
        } catch (error) {
            console.error('Error in update:', error);
            this.clear();
            this.host.eventService?.renderingFinished(options);
        }
    }

    private extractData(dataView: DataView): GaugeData[] | null {
        try {
            const gaugesData: GaugeData[] = [];
            
            // Get category values
            let categories: any[] = [];
            const categoryColumn = dataView.categorical?.categories?.[0];
            if (dataView.categorical?.categories && dataView.categorical.categories.length > 0) {
                categories = Array.from(dataView.categorical.categories[0].values);
            } else {
                // No categories - create single gauge with no category label
                categories = [null];
            }

            // Extract values from categorical data view
            if (dataView.categorical?.values) {
                const values = dataView.categorical.values;
                
                // Loop through each category
                for (let catIndex = 0; catIndex < categories.length; catIndex++) {
                    const category = categories[catIndex] !== null ? String(categories[catIndex]) : null;
                    
                    let value: number | null = null;
                    let previousValue: number | null = null;
                    let minimum = 0;
                    let maximum = 100;
                    let target: number | null = null;
                    let threshold1: number | null = null;
                    let threshold2: number | null = null;
                    let threshold3: number | null = null;
                    let threshold4: number | null = null;
                    const customTooltips: VisualTooltipDataItem[] = [];
                    let selectionId: ISelectionId | null = null;

                    if (categoryColumn && categories[catIndex] !== null) {
                        selectionId = this.host.createSelectionIdBuilder()
                            .withCategory(categoryColumn, catIndex)
                            .createSelectionId();
                    }
                    
                    // Extract values for this category index
                    for (let i = 0; i < values.length; i++) {
                        const column = values[i];
                        const role = column.source.roles;
                        
                        if (role && column.values.length > catIndex) {
                            const rawVal = column.values[catIndex];
                            const val = Number(rawVal);
                            
                            if (role['value']) {
                                value = val;
                            } else if (role['previousValue']) {
                                previousValue = Number.isFinite(val) ? val : null;
                            } else if (role['minimum']) {
                                minimum = val;
                            } else if (role['maximum']) {
                                maximum = val;
                            } else if (role['target']) {
                                target = val;
                            } else if (role['threshold1']) {
                                threshold1 = val;
                            } else if (role['threshold2']) {
                                threshold2 = val;
                            } else if (role['threshold3']) {
                                threshold3 = val;
                            } else if (role['threshold4']) {
                                threshold4 = val;
                            } else if (role['tooltip']) {
                                if (rawVal !== null && rawVal !== undefined) {
                                    customTooltips.push({
                                        displayName: column.source.displayName || 'Tooltip',
                                        value: String(rawVal)
                                    });
                                }
                            }
                        }
                    }
                    
                    // Value is required
                    if (value !== null && value !== undefined && !isNaN(value)) {
                        // Ensure min < max
                        if (minimum >= maximum) {
                            maximum = minimum + 100;
                        }
                        
                        gaugesData.push({
                            category,
                            value,
                            previousValue,
                            minimum,
                            maximum,
                            target,
                            threshold1,
                            threshold2,
                            threshold3,
                            threshold4,
                            customTooltips,
                            selectionId,
                            color: this.colorPalette.getColor(category || `gauge_${catIndex}`).value
                        });
                    }
                }
            }
            
            return gaugesData.length > 0 ? gaugesData : null;
        } catch (error) {
            console.error('Error extracting data:', error);
            return null;
        }
    }

    private renderMultipleGauges(gaugesData: GaugeData[], width: number, height: number) {
        this.clear();

        const settings = this.formattingSettings.gaugeSettings;
        const compactFactor = this.getLayoutDensityFactor();
        const gaugeBodyWidth = Math.max(40, settings.gaugeWidth.value);
        const gaugeCount = gaugesData.length;
        if (gaugeCount === 0) return;

        const configuredPadding = this.formattingSettings.gaugeSettings.gaugePadding.value;
        const configuredVerticalPadding = this.formattingSettings.gaugeSettings.gaugeVerticalPadding.value;
        const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = Math.max(2, Math.round(this.formattingSettings.categoryLayout.categoryPadding.value * compactFactor));
        const showCategoryLabel = this.formattingSettings.gaugeSettings.showCategoryLabel.value && !this.isSecondaryTextHidden();
        const isVertical = settings.orientation.value.value === 'vertical';
        const horizontalPadding = Math.round(configuredPadding * compactFactor);
        const verticalPadding = Math.round(configuredVerticalPadding * compactFactor);
        const categoryFontSize = this.formattingSettings.categoryLayout.categoryFontSize.value;

        const maxCategoryLines = showCategoryLabel
            ? gaugesData.reduce((maxLines, gauge) => {
                if (!gauge.category) return maxLines;
                const lines = this.getCategoryLines(gauge.category, gaugeBodyWidth, categoryFontSize, categoryPosition).length;
                return Math.max(maxLines, lines);
            }, 1)
            : 1;
        const categoryBlockHeight = Math.max(12, categoryFontSize + 2) * Math.max(1, maxCategoryLines);

        const maxTopTrendMargin = gaugesData.reduce((maxMargin, gauge) => {
            const trendMetrics = this.getTrendMetrics(gauge);
            if (trendMetrics.lineCount === 0 || trendMetrics.position !== 'top') {
                return maxMargin;
            }
            return Math.max(maxMargin, (trendMetrics.lineCount * Math.max(12, this.getEffectiveLabelFontSize(this.formattingSettings.analyticsSettings.trendFontSize.value) + 2)) + 12);
        }, 0);

        const maxBottomMargin = gaugesData.reduce(
            (maxMargin, gauge) => Math.max(maxMargin, this.getGaugeBottomMargin(gauge, isVertical, categoryBlockHeight, categoryPadding, categoryPosition, showCategoryLabel)),
            this.getGaugeBottomMargin(gaugesData[0], isVertical, categoryBlockHeight, categoryPadding, categoryPosition, showCategoryLabel)
        );

        const topBaseMargin = (showCategoryLabel && categoryPosition.startsWith('top'))
            ? (categoryPadding + categoryBlockHeight + 10)
            : 16;
        const topMargin = Math.max(10, Math.round((topBaseMargin + maxTopTrendMargin) * compactFactor));
        const bottomMargin = maxBottomMargin;

        // Calculate layout dimensions with grid support
        const gaugeWidth = gaugeBodyWidth;
        const maxPerRow = this.formattingSettings.gaugeSettings.maxGaugesPerRow.value;
        const maxPerColumn = this.formattingSettings.gaugeSettings.maxGaugesPerColumn.value;
        
        // Determine columns: if maxPerRow is set (>0), use it; otherwise all gauges in one row
        let cols = (maxPerRow > 0) ? Math.min(maxPerRow, gaugeCount) : gaugeCount;
        
        // Calculate fixed gauge slot height (don't stretch with viewport)
        const minimumBodyHeight = 80;
        const minimumSlotHeight = minimumBodyHeight + topMargin + bottomMargin;
        const gaugeSlotHeight = minimumSlotHeight;
        
        // Calculate how many rows can fit in the available viewport height
        const availableRowsInViewport = maxPerColumn > 0 
            ? maxPerColumn 
            : Math.max(1, Math.floor((height + verticalPadding) / (gaugeSlotHeight + verticalPadding)));
        
        // Calculate total rows needed for all gauges
        const totalRowsNeeded = Math.ceil(gaugeCount / cols);
        
        // Determine actual rows to render (minimum of what's needed and what fits)
        const rows = Math.min(totalRowsNeeded, availableRowsInViewport);
        
        // Calculate how many gauges we can actually show in the grid
        const maxVisibleGauges = rows * cols;
        const visibleGaugeCount = Math.min(gaugeCount, maxVisibleGauges);
        
        const requiredWidth = cols * gaugeWidth + Math.max(0, cols - 1) * horizontalPadding;
        const requiredHeight = rows * gaugeSlotHeight + Math.max(0, rows - 1) * verticalPadding;
        const horizontalScrollbarClearance = requiredWidth > (width + 1) ? 16 : 0;

        // Start at viewport size; after rendering, resize to actual drawn bounds.
        this.svg
            .attr('width', Math.max(1, width))
            .attr('height', Math.max(1, height));

        // Render each visible gauge
        for (let i = 0; i < visibleGaugeCount; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = col * (gaugeWidth + horizontalPadding);
            const y = row * (gaugeSlotHeight + verticalPadding);

            const gaugeGroup = this.container.append('g')
                .classed('gauge-item', true)
                .attr('transform', `translate(${x}, ${y})`);

            const gaugeData = gaugesData[i];
            gaugeGroup
                .attr('role', 'img')
                .attr('aria-label', this.getGaugeAriaLabel(gaugeData, i, gaugeCount));

            if (this.allowInteractions && gaugeData.selectionId) {
                gaugeGroup.style('cursor', 'pointer');
                gaugeGroup.on('click', (event: MouseEvent) => {
                    event.stopPropagation();
                    this.selectionManager.select(gaugeData.selectionId as ISelectionId, event.ctrlKey);
                });
                gaugeGroup.on('contextmenu', (event: PointerEvent) => {
                    event.stopPropagation();
                    this.selectionManager.showContextMenu(gaugeData.selectionId as ISelectionId, {
                        x: event.clientX,
                        y: event.clientY
                    });
                    event.preventDefault();
                });
            } else {
                gaugeGroup.style('cursor', 'default');
            }

            const originalContainer = this.container;
            this.container = gaugeGroup;
            this.render(gaugeData, gaugeWidth, gaugeSlotHeight, maxCategoryLines, horizontalScrollbarClearance);
            this.container = originalContainer;
        }

        // Match SVG size to actual rendered content so scrollbars only appear on real overflow.
        const containerNode = this.container.node();
        if (containerNode) {
            const bounds = containerNode.getBBox();
            const drawnWidth = Math.max(0, Math.ceil(bounds.x + bounds.width));
            const drawnHeight = Math.max(0, Math.ceil(bounds.y + bounds.height));
            const finalWidth = Math.max(width, drawnWidth || requiredWidth);
            const finalHeight = Math.max(height, drawnHeight || requiredHeight);
            const overflowEpsilon = 1;
            const hasHorizontalOverflow = finalWidth > (width + overflowEpsilon);
            const hasVerticalOverflow = finalHeight > (height + overflowEpsilon);

            this.svg
                .attr('width', finalWidth)
                .attr('height', finalHeight);

            this.scrollContainer.style.overflowX = hasHorizontalOverflow ? 'auto' : 'hidden';
            this.scrollContainer.style.overflowY = hasVerticalOverflow ? 'auto' : 'hidden';
        } else {
            this.scrollContainer.style.overflowX = requiredWidth > (width + 1) ? 'auto' : 'hidden';
            this.scrollContainer.style.overflowY = 'hidden';
        }
    }

    private render(data: GaugeData, width: number, height: number, fixedCategoryLineCount?: number, bottomOverlayOffset: number = 0) {
        const settings = this.formattingSettings;
        const compactFactor = this.getLayoutDensityFactor();
        const isVertical = settings.gaugeSettings.orientation.value.value === 'vertical';
        const showCategoryLabel = settings.gaugeSettings.showCategoryLabel.value && !this.isSecondaryTextHidden();
        const categoryPosition = settings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = Math.max(2, Math.round(settings.categoryLayout.categoryPadding.value * compactFactor));
        const configuredGaugeWidth = settings.gaugeSettings.gaugeWidth.value;
        const categoryFontSize = settings.categoryLayout.categoryFontSize.value;
        const categoryLineCount = fixedCategoryLineCount ?? ((showCategoryLabel && data.category)
            ? this.getCategoryLines(data.category, width, categoryFontSize, categoryPosition).length
            : 1);
        const categoryBlockHeight = Math.max(12, categoryFontSize + 2) * Math.max(1, categoryLineCount);
        
        // Define margins and dimensions with extra space for left-side labels/ticks and category placement
        const trendMetrics = this.getTrendMetrics(data);
        const topTrendMargin = trendMetrics.lineCount > 0 && trendMetrics.position === 'top'
            ? (trendMetrics.lineCount * Math.max(12, this.getEffectiveLabelFontSize(this.formattingSettings.analyticsSettings.trendFontSize.value) + 2)) + 12
            : 0;
        const baseTopMargin = (showCategoryLabel && categoryPosition.startsWith('top')) ? (categoryPadding + categoryBlockHeight + 10) : 16;
        const margin = {
            top: Math.max(10, Math.round((baseTopMargin + topTrendMargin) * compactFactor)),
            right: this.getGaugeRightMargin(data, isVertical),
            bottom: this.getGaugeBottomMargin(data, isVertical, categoryBlockHeight, categoryPadding, categoryPosition, showCategoryLabel) + bottomOverlayOffset,
            left: this.getGaugeLeftMargin(data, isVertical)
        };
        const maxAvailableWidth = Math.max(30, width - margin.left - margin.right);
        const gaugeWidth = isVertical
            ? Math.max(30, Math.min(configuredGaugeWidth, maxAvailableWidth))
            : Math.max(60, Math.min(configuredGaugeWidth, maxAvailableWidth));
        const gaugeHeight = isVertical 
            ? height - margin.top - margin.bottom
            : Math.max(24, (height - margin.top - margin.bottom) * 0.62);
        
        // Clear previous content from this container
        this.container.selectAll('*').remove();
        
        // Create a content group with margin offset (don't modify container's transform)
        const contentGroup = this.container.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Temporarily use contentGroup as the container for rendering
        const originalContainer = this.container;
        this.container = contentGroup;
        
        // Create linear scale
        const scale = d3.scaleLinear()
            .domain([data.minimum, data.maximum])
            .range([0, isVertical ? gaugeHeight : gaugeWidth])
            .clamp(true);
        
        // Render color zones
        this.renderColorZones(data, scale, gaugeWidth, gaugeHeight, isVertical);
        
        // Render fill bar (actual value)
        this.renderFillBar(data, scale, gaugeWidth, gaugeHeight, isVertical);
        
        // Render border
        this.renderBorder(gaugeWidth, gaugeHeight, isVertical);
        
        const effectiveTarget = this.getEffectiveTargetValue(data);

        if (settings.analyticsSettings.showTargetBands.value && effectiveTarget !== null) {
            this.renderTargetBandState(data, effectiveTarget, gaugeWidth, gaugeHeight, isVertical);
        }

        // Render target marker if enabled and an effective target exists
        if (settings.targetSettings.showTarget.value && effectiveTarget !== null) {
            this.renderTargetMarker(data, effectiveTarget, scale, gaugeWidth, gaugeHeight, isVertical);
        }
        
        // Render labels if enabled
        if (settings.valueFormatting.showLabels.value) {
            const formatType = settings.valueFormatting.valueFormat.value.value as string;
            this.renderLabels(data, scale, gaugeWidth, gaugeHeight, isVertical, margin, formatType);
        }
        
        // Render comparison indicator if enabled and an effective target exists
        if (settings.targetSettings.showComparison.value && effectiveTarget !== null && !this.isSecondaryTextHidden()) {
            this.renderComparison(data, effectiveTarget, gaugeWidth, gaugeHeight, isVertical, margin);
        }

        if (settings.analyticsSettings.showTrendIndicator.value && data.previousValue !== null && !this.isSecondaryTextHidden()) {
            this.renderTrendIndicator(data, gaugeWidth, gaugeHeight, isVertical);
        }
        
        // Render category label if enabled and category exists
        if (showCategoryLabel && data.category !== null) {
            this.renderCategoryLabel(data.category, gaugeWidth, gaugeHeight, isVertical);
        }
        
        // Restore original container
        this.container = originalContainer;
    }

    private renderColorZones(data: GaugeData, scale: d3.ScaleLinear<number, number>, 
                            width: number, height: number, isVertical: boolean) {
        const settings = this.formattingSettings.colorZones;
        
        // Determine threshold values based on mode (4 thresholds for 4 zones)
        let threshold1: number, threshold2: number, threshold3: number, threshold4: number;
        const thresholdMode = settings.thresholdMode.value.value as string;
        
        if (thresholdMode === 'absolute' && data.threshold1 !== null && data.threshold2 !== null && 
            data.threshold3 !== null && data.threshold4 !== null) {
            // Use absolute values from data
            threshold1 = data.threshold1;
            threshold2 = data.threshold2;
            threshold3 = data.threshold3;
            threshold4 = data.threshold4;
        } else {
            // Use percentage-based values from settings
            const range = data.maximum - data.minimum;
            threshold1 = data.minimum + (range * settings.threshold1.value / 100);
            threshold2 = data.minimum + (range * settings.threshold2.value / 100);
            threshold3 = data.minimum + (range * settings.threshold3.value / 100);
            threshold4 = data.minimum + (range * settings.threshold4.value / 100);
        }
        
        // 4 color zones: Red, Yellow, Green, Light Blue
        const zones = [
            { start: data.minimum, end: threshold1, color: settings.redColor.value.value, name: 'Red' },
            { start: threshold1, end: threshold2, color: settings.yellowColor.value.value, name: 'Yellow' },
            { start: threshold2, end: threshold3, color: settings.greenColor.value.value, name: 'Green' },
            { start: threshold3, end: data.maximum, color: settings.lightBlueColor.value.value, name: 'Light Blue' }
        ];
        
        const zonesGroup = this.container.append('g').classed('color-zones', true);
        
        zones.forEach(zone => {
            const startPos = scale(zone.start);
            const endPos = scale(zone.end);
            const zoneSize = endPos - startPos;
            
            if (isVertical) {
                // For vertical: fill from bottom to top
                zonesGroup.append('rect')
                    .attr('x', 0)
                    .attr('y', height - endPos)
                    .attr('width', width)
                    .attr('height', zoneSize)
                    .attr('fill', zone.color)
                    .attr('opacity', 0.45);
            } else {
                // For horizontal: fill from left to right
                zonesGroup.append('rect')
                    .attr('x', startPos)
                    .attr('y', 0)
                    .attr('width', zoneSize)
                    .attr('height', height)
                    .attr('fill', zone.color)
                    .attr('opacity', 0.45);
            }
        });
        
        // Render threshold marker lines and optional labels
        if (settings.showThresholdLabels.value && !this.isSecondaryTextHidden()) {
            const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
            const thresholdOnRight = isVertical && categoryPosition === 'left';
            const thresholdFontSize = this.getEffectiveLabelFontSize(settings.thresholdFontSize.value);
            const thresholdFontFamily = settings.thresholdFontFamily.value;
            const thresholdLabelColor = this.getContrastSafeTextColor(settings.thresholdLabelColor.value.value);
            const thresholdBold = settings.thresholdBold.value;
            const thresholdItalic = settings.thresholdItalic.value;
            const lineStyle = settings.thresholdLineStyle.value.value as string;
            const lineDashArray = this.getThresholdLineDashArray(lineStyle);
            const maxLabelLength = Math.max(1, Math.floor(settings.thresholdMaxLabelLength.value));
            
            // Show all 4 threshold boundaries
            const thresholds = [
                {
                    value: threshold1,
                    label: this.truncateThresholdLabel(this.formatThresholdValue(threshold1), maxLabelLength),
                    position: 0,
                    showLabel: settings.showThreshold1Label.value
                },
                {
                    value: threshold2,
                    label: this.truncateThresholdLabel(this.formatThresholdValue(threshold2), maxLabelLength),
                    position: 0,
                    showLabel: settings.showThreshold2Label.value
                },
                {
                    value: threshold3,
                    label: this.truncateThresholdLabel(this.formatThresholdValue(threshold3), maxLabelLength),
                    position: 0,
                    showLabel: settings.showThreshold3Label.value
                },
                {
                    value: threshold4,
                    label: this.truncateThresholdLabel(this.formatThresholdValue(threshold4), maxLabelLength),
                    position: 0,
                    showLabel: settings.showThreshold4Label.value
                }
            ];
            
            // Calculate positions and detect overlaps
            thresholds.forEach(threshold => {
                threshold.position = scale(threshold.value);
            });
            
            // Minimum spacing between labels (in pixels)
            const minSpacing = thresholdFontSize * 1.5;
            const adjustedPositions: number[] = [];
            
            // For vertical orientation, check Y positions
            if (isVertical) {
                for (let i = 0; i < thresholds.length; i++) {
                    let pos = thresholds[i].position;
                    
                    // Check against previous labels
                    for (let j = 0; j < i; j++) {
                        const prevPos = adjustedPositions[j];
                        const distance = Math.abs((height - pos) - (height - prevPos));
                        
                        if (distance < minSpacing) {
                            // Offset this label to avoid overlap
                            if ((height - pos) < (height - prevPos)) {
                                pos = prevPos - (minSpacing / scale(data.maximum));
                            } else {
                                pos = prevPos + (minSpacing / scale(data.maximum));
                            }
                        }
                    }
                    adjustedPositions.push(pos);
                }
            } else {
                // For horizontal orientation
                for (let i = 0; i < thresholds.length; i++) {
                    let pos = thresholds[i].position;
                    
                    // Check against previous labels
                    for (let j = 0; j < i; j++) {
                        const prevPos = adjustedPositions[j];
                        const distance = Math.abs(pos - prevPos);
                        
                        if (distance < minSpacing) {
                            // Offset this label to avoid overlap
                            if (pos < prevPos) {
                                pos = prevPos - minSpacing;
                            } else {
                                pos = prevPos + minSpacing;
                            }
                        }
                    }
                    adjustedPositions.push(pos);
                }
            }
            
            const thresholdLabelsGroup = this.container.append('g').classed('threshold-labels', true);
            
            thresholds.forEach((threshold, index) => {
                const pos = adjustedPositions[index];
                
                if (isVertical) {
                    thresholdLabelsGroup.append('line')
                        .attr('x1', thresholdOnRight ? width : 0)
                        .attr('x2', thresholdOnRight ? width + 6 : -6)
                        .attr('y1', height - threshold.position)
                        .attr('y2', height - threshold.position)
                        .attr('stroke', this.getColor('#777'))
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', lineDashArray);

                    // Vertical: labels on opposite side when left category labels are used
                    if (threshold.showLabel) {
                        thresholdLabelsGroup.append('text')
                            .attr('x', thresholdOnRight ? width + 8 : -8)
                            .attr('y', height - pos + 4)
                            .attr('text-anchor', thresholdOnRight ? 'start' : 'end')
                            .attr('font-size', `${thresholdFontSize}px`)
                            .attr('font-family', thresholdFontFamily)
                            .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                            .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                            .attr('fill', thresholdLabelColor)
                            .attr('opacity', 0.8)
                            .text(threshold.label);
                    }
                } else {
                    thresholdLabelsGroup.append('line')
                        .attr('x1', threshold.position)
                        .attr('x2', threshold.position)
                        .attr('y1', 0)
                        .attr('y2', -6)
                        .attr('stroke', this.getColor('#777'))
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', lineDashArray);

                    // Horizontal: labels above at threshold positions
                    if (threshold.showLabel) {
                        thresholdLabelsGroup.append('text')
                            .attr('x', pos)
                            .attr('y', -8)
                            .attr('text-anchor', 'middle')
                            .attr('font-size', `${thresholdFontSize}px`)
                            .attr('font-family', thresholdFontFamily)
                            .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                            .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                            .attr('fill', thresholdLabelColor)
                            .attr('opacity', 0.8)
                            .text(threshold.label);
                    }
                }
            });
        }
    }

    private renderFillBar(data: GaugeData, scale: d3.ScaleLinear<number, number>, 
                         width: number, height: number, isVertical: boolean) {
        const fillSize = scale(data.value) - scale(data.minimum);
        const animationDuration = this.isAnimationDisabled() ? 0 : this.formattingSettings.gaugeSettings.animationDuration.value;
        const fillThicknessPercent = this.formattingSettings.gaugeSettings.fillThicknessFactor.value;
        const fillThicknessFactor = Math.max(5, Math.min(100, fillThicknessPercent)) / 100;
        
        // Determine fill color based on value position (4 zones)
        const settings = this.formattingSettings.colorZones;
        const thresholdMode = settings.thresholdMode.value.value as string;
        
        // Get threshold values (4 thresholds for 4 zones)
        let threshold1: number, threshold2: number, threshold3: number, threshold4: number;
        
        if (thresholdMode === 'absolute' && data.threshold1 !== null && data.threshold2 !== null && 
            data.threshold3 !== null && data.threshold4 !== null) {
            // Use absolute values from data
            threshold1 = data.threshold1;
            threshold2 = data.threshold2;
            threshold3 = data.threshold3;
            threshold4 = data.threshold4;
        } else {
            // Use percentage-based values from settings
            const range = data.maximum - data.minimum;
            threshold1 = data.minimum + (range * settings.threshold1.value / 100);
            threshold2 = data.minimum + (range * settings.threshold2.value / 100);
            threshold3 = data.minimum + (range * settings.threshold3.value / 100);
            threshold4 = data.minimum + (range * settings.threshold4.value / 100);
        }
        
        // 4 color zones: Red < threshold1, Yellow < threshold2, Green < threshold3, Light Blue >= threshold3
        let fillColor = settings.redColor.value.value;
        if (data.value >= threshold3) {
            fillColor = settings.lightBlueColor.value.value;
        } else if (data.value >= threshold2) {
            fillColor = settings.greenColor.value.value;
        } else if (data.value >= threshold1) {
            fillColor = settings.yellowColor.value.value;
        }

        // Optional static override for value color
        if (this.formattingSettings.gaugeSettings.useStaticValueColor.value) {
            fillColor = this.formattingSettings.gaugeSettings.staticValueColor.value.value;
        }
        // else: use the threshold-based color determined above
        
        // Tooltip data shared by both branches
        const tooltipData = this.getTooltipData(data);

        if (isVertical) {
            const barWidth = width * fillThicknessFactor;
            const barX = (width - barWidth) / 2;

            // Wrap the rect in a group so we can scale it from the bottom anchor point.
            // transform: translate(0,h) scale(1,scaleY) translate(0,-h) pivots around y=h,
            // keeping the bottom edge fixed while the top edge grows upward from 0 to fillSize.
            const fillGroup = this.container.append('g')
                .attr('transform', `translate(0,${height}) scale(1,0) translate(0,${-height})`);

            const fillBar = fillGroup.append('rect')
                .classed('fill-bar', true)
                .attr('x', barX)
                .attr('y', height - fillSize)
                .attr('width', barWidth)
                .attr('height', fillSize)
                .attr('rx', 0)
                .attr('ry', 0)
                .attr('fill', fillColor)
                .attr('stroke', this.getColor('#333'))
                .attr('stroke-width', 1)
                .attr('opacity', 0.75)
                .attr('aria-label', `Value fill: ${this.formatValue(data.value)}`);

            if (tooltipData.length > 0) {
                this.tooltipServiceWrapper.addTooltip(
                    fillBar,
                    (tooltipEvent: TooltipEventArgs<any>) => tooltipData
                );
            }

            // Animate scaleY from 0→1 so the bar grows from the bottom up to the value
            fillGroup.transition()
                .duration(animationDuration)
                .ease(d3.easeQuadInOut)
                .attrTween('transform', () => {
                    const sc = d3.interpolateNumber(0, 1);
                    return (t: number) => `translate(0,${height}) scale(1,${sc(t)}) translate(0,${-height})`;
                });
        } else {
            const barHeight = height * fillThicknessFactor;
            const barY = (height - barHeight) / 2;

            // For horizontal: fill from left to right
            const fillBar = this.container.append('rect')
                .classed('fill-bar', true)
                .attr('x', 0)
                .attr('y', barY)
                .attr('width', 0)
                .attr('height', barHeight)
                .attr('rx', 0)
                .attr('ry', 0)
                .attr('fill', fillColor)
                .attr('stroke', this.getColor('#333'))
                .attr('stroke-width', 1)
                .attr('opacity', 0.75)
                .attr('aria-label', `Value fill: ${this.formatValue(data.value)}`);

            if (tooltipData.length > 0) {
                this.tooltipServiceWrapper.addTooltip(
                    fillBar,
                    (tooltipEvent: TooltipEventArgs<any>) => tooltipData
                );
            }

            // Animate the fill bar rightward
            fillBar.transition()
                .duration(animationDuration)
                .ease(d3.easeQuadInOut)
                .attr('width', fillSize);
        }
    }

    private renderBorder(width: number, height: number, isVertical: boolean) {
        this.container.append('rect')
            .classed('border', true)
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('stroke', this.getColor('#666'))
            .attr('stroke-width', 2);
    }

    private renderTargetMarker(data: GaugeData, targetValue: number, scale: d3.ScaleLinear<number, number>, 
                               width: number, height: number, isVertical: boolean) {
        const targetPos = scale(targetValue);
        const markerColor = this.formattingSettings.targetSettings.targetColor.value.value;
        
        const markerGroup = this.container.append('g').classed('target-marker', true);
        markerGroup.attr('aria-label', `Target marker: ${this.formatThresholdValue(targetValue)}`);
        
        // Add tooltip to target marker
        const formatType = this.formattingSettings.valueFormatting.valueFormat.value.value as string;
        const format = formatType === 'percentage' ? d3.format('.0%') : d3.format(',.0f');
        const getDisplayValue = (value: number) => formatType === 'percentage' ? value / 100 : value;
        
        const targetTooltipData = this.getTooltipData(data);
        if (targetTooltipData.length > 0) {
            this.tooltipServiceWrapper.addTooltip(
                markerGroup,
                (tooltipEvent: TooltipEventArgs<any>) => targetTooltipData
            );
        }
        
        if (isVertical) {
            // Vertical line for horizontal gauge
            markerGroup.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', height - targetPos)
                .attr('y2', height - targetPos)
                .attr('stroke', markerColor)
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '5,5');
            
            // Triangle marker
            markerGroup.append('polygon')
                .attr('points', `${width},${height - targetPos} ${width + 8},${height - targetPos - 5} ${width + 8},${height - targetPos + 5}`)
                .attr('fill', markerColor);
        } else {
            // Horizontal line for vertical gauge
            markerGroup.append('line')
                .attr('x1', targetPos)
                .attr('x2', targetPos)
                .attr('y1', 0)
                .attr('y2', height)
                .attr('stroke', markerColor)
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '5,5');
            
            // Triangle marker
            markerGroup.append('polygon')
                .attr('points', `${targetPos},${height} ${targetPos - 5},${height + 8} ${targetPos + 5},${height + 8}`)
                .attr('fill', markerColor);
        }
    }

    private renderLabels(data: GaugeData, scale: d3.ScaleLinear<number, number>, 
                        width: number, height: number, isVertical: boolean, margin: any, formatType: string) {
        const labelsGroup = this.container.append('g').classed('labels', true);
        const valueLabelPosition = this.formattingSettings.valueFormatting.valueLabelPosition.value.value as string;
        const valueFontSize = this.getEffectiveLabelFontSize(this.formattingSettings.valueFormatting.valueFontSize.value);
        const valueFontFamily = this.formattingSettings.valueFormatting.valueFontFamily.value;
        const valueLabelColor = this.getContrastSafeTextColor(this.formattingSettings.valueFormatting.valueLabelColor.value.value);
        const valueBold = this.formattingSettings.valueFormatting.valueBold.value;
        const valueItalic = this.formattingSettings.valueFormatting.valueItalic.value;
        
        const thresholdLabelColor = this.getContrastSafeTextColor(this.formattingSettings.colorZones.thresholdLabelColor.value.value);
        const thresholdBold = this.formattingSettings.colorZones.thresholdBold.value;
        const thresholdItalic = this.formattingSettings.colorZones.thresholdItalic.value;
        const showMinScaleLabel = !this.isSecondaryTextHidden() && this.shouldShowScaleLabel('min');
        const showMaxScaleLabel = !this.isSecondaryTextHidden() && this.shouldShowScaleLabel('max');
        
        const fillThicknessPercent = this.formattingSettings.gaugeSettings.fillThicknessFactor.value;
        const fillThicknessFactor = Math.max(5, Math.min(100, fillThicknessPercent)) / 100;
        
        // Calculate offset for category label if shown
        const showCategoryLabel = this.formattingSettings.gaugeSettings.showCategoryLabel.value;
        const categoryFontSize = this.formattingSettings.categoryLayout.categoryFontSize.value;
        const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = this.formattingSettings.categoryLayout.categoryPadding.value;
        const categoryLineCount = (showCategoryLabel && data.category)
            ? this.getCategoryLines(data.category, width, categoryFontSize, categoryPosition).length
            : 1;
        
        // Extra space needed above gauge if category is shown at top
        // Category is at y=-15, extends upward by categoryFontSize
        // Value label should be positioned above that with extra padding
        const topOffset = (showCategoryLabel && (categoryPosition === 'top-left' || categoryPosition === 'top-center' || categoryPosition === 'top-right')) 
            ? -(((categoryLineCount - 1) * Math.max(12, categoryFontSize + 2)) + categoryPadding + categoryFontSize + 12)
            : -10; // Default position
        
        if (isVertical) {
            // Min tick and label on left side
            if (showMinScaleLabel) {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -6)
                    .attr('y1', height)
                    .attr('y2', height)
                    .attr('stroke', this.getColor('#666'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -8)
                    .attr('y', height + 4)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${this.getEffectiveLabelFontSize(this.formattingSettings.colorZones.thresholdFontSize.value)}px`)
                    .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                    .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                    .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                    .attr('fill', thresholdLabelColor)
                    .text(this.formatThresholdValue(data.minimum));
            }
            
            // Max tick and label on left side
            if (showMaxScaleLabel) {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -6)
                    .attr('y1', 0)
                    .attr('y2', 0)
                    .attr('stroke', this.getColor('#666'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -8)
                    .attr('y', 4)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${this.getEffectiveLabelFontSize(this.formattingSettings.colorZones.thresholdFontSize.value)}px`)
                    .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                    .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                    .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                    .attr('fill', thresholdLabelColor)
                    .text(this.formatThresholdValue(data.maximum));
            }
            
            // Current value label (side)
            const valueY = height - scale(data.value);
            if (valueLabelPosition === 'left') {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -8)
                    .attr('y1', valueY)
                    .attr('y2', valueY)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -10)
                    .attr('y', valueY + 5)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            } else if (valueLabelPosition === 'top-center') {
                const valueTopY = valueY;
                labelsGroup.append('line')
                    .attr('x1', width / 2)
                    .attr('x2', width / 2)
                    .attr('y1', valueTopY)
                    .attr('y2', valueTopY - 6)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width / 2)
                    .attr('y', valueTopY - 8)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            } else {
                labelsGroup.append('line')
                    .attr('x1', width)
                    .attr('x2', width + 8)
                    .attr('y1', valueY)
                    .attr('y2', valueY)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width + 10)
                    .attr('y', valueY + 5)
                    .attr('text-anchor', 'start')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            }
        } else {
            // Min tick and label on left side
            if (showMinScaleLabel) {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -6)
                    .attr('y1', height)
                    .attr('y2', height)
                    .attr('stroke', this.getColor('#666'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -8)
                    .attr('y', height + 4)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${this.getEffectiveLabelFontSize(this.formattingSettings.colorZones.thresholdFontSize.value)}px`)
                    .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                    .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                    .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                    .attr('fill', thresholdLabelColor)
                    .text(this.formatThresholdValue(data.minimum));
            }
            
            // Max tick and label on left side
            if (showMaxScaleLabel) {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -6)
                    .attr('y1', 0)
                    .attr('y2', 0)
                    .attr('stroke', this.getColor('#666'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -8)
                    .attr('y', 4)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${this.getEffectiveLabelFontSize(this.formattingSettings.colorZones.thresholdFontSize.value)}px`)
                    .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                    .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                    .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                    .attr('fill', thresholdLabelColor)
                    .text(this.formatThresholdValue(data.maximum));
            }
            
            // Current value label with configurable placement
            const valueX = scale(data.value);

            if (valueLabelPosition === 'left') {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -8)
                    .attr('y1', height / 2)
                    .attr('y2', height / 2)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -10)
                    .attr('y', height / 2 + 5)
                    .attr('text-anchor', 'end')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            } else if (valueLabelPosition === 'right') {
                labelsGroup.append('line')
                    .attr('x1', width)
                    .attr('x2', width + 8)
                    .attr('y1', height / 2)
                    .attr('y2', height / 2)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width + 10)
                    .attr('y', height / 2 + 5)
                    .attr('text-anchor', 'start')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            } else {
                const barHeight = height * fillThicknessFactor;
                const barTopY = (height - barHeight) / 2;

                labelsGroup.append('line')
                    .attr('x1', valueX)
                    .attr('x2', valueX)
                    .attr('y1', barTopY)
                    .attr('y2', barTopY - 6)
                    .attr('stroke', this.getColor('#333'))
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', valueX)
                    .attr('y', barTopY - 8)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-family', valueFontFamily)
                    .attr('font-weight', valueBold ? 'bold' : 'normal')
                    .attr('font-style', valueItalic ? 'italic' : 'normal')
                    .attr('fill', valueLabelColor)
                    .text(this.formatValue(data.value));
            }
        }
    }

    private renderComparison(data: GaugeData, targetValue: number, width: number, height: number, 
                            isVertical: boolean, margin: any) {
        const comparisonDisplay = this.formattingSettings.targetSettings.comparisonDisplay.value.value as string;
        if (comparisonDisplay === 'off') return;
        const comparisonPosition = this.getComparisonPosition();
        
        const delta = data.value - targetValue;
        const hasValidTargetForPercent = targetValue !== 0;
        const deltaPercent = hasValidTargetForPercent ? (delta / targetValue) : null;
        const comparisonLines = this.getComparisonLines(delta, deltaPercent, comparisonDisplay);
        
        const color = delta >= 0
            ? this.formattingSettings.targetSettings.comparisonPositiveColor.value.value
            : this.formattingSettings.targetSettings.comparisonNegativeColor.value.value;
        const fontSize = this.getEffectiveLabelFontSize(this.formattingSettings.targetSettings.comparisonFontSize.value);
        const fontFamily = this.formattingSettings.targetSettings.comparisonFontFamily.value;
        const fontWeight = this.formattingSettings.targetSettings.comparisonBold.value ? 'bold' : 'normal';
        const fontStyle = this.formattingSettings.targetSettings.comparisonItalic.value ? 'italic' : 'normal';
        const lineHeight = Math.max(12, fontSize + 2);
        
        const comparisonGroup = this.container.append('g').classed('comparison', true);

        const textElement = comparisonGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', `${fontSize}px`)
            .attr('font-family', fontFamily)
            .attr('font-weight', fontWeight)
            .attr('font-style', fontStyle)
            .attr('fill', this.getContrastSafeTextColor(color));

        let comparisonX = width / 2;
        let comparisonY = height + lineHeight + 10;
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';

        if (comparisonPosition === 'top') {
            comparisonX = width / 2;
            comparisonY = lineHeight;
            textAnchor = 'middle';
        } else if (comparisonPosition === 'left') {
            comparisonX = -10;
            comparisonY = Math.max(lineHeight, (height / 2) - (((comparisonLines.length - 1) * lineHeight) / 2));
            textAnchor = 'end';
        } else if (comparisonPosition === 'right') {
            comparisonX = width + 10;
            comparisonY = Math.max(lineHeight, (height / 2) - (((comparisonLines.length - 1) * lineHeight) / 2));
            textAnchor = 'start';
        }

        textElement.attr('text-anchor', textAnchor);
        textElement
            .attr('x', comparisonX)
            .attr('y', comparisonY);

        comparisonLines.forEach((line, index) => {
            textElement.append('tspan')
                .attr('x', comparisonX)
                .attr('dy', index === 0 ? 0 : lineHeight)
                .text(line);
        });
    }

    private renderTrendIndicator(data: GaugeData, width: number, height: number, isVertical: boolean): void {
        if (data.previousValue === null) {
            return;
        }

        const delta = data.value - data.previousValue;
        const hasPercent = data.previousValue !== 0;
        const deltaPercent = hasPercent ? (delta / data.previousValue) : null;
        const directionArrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '▶');
        const trendSettings = this.formattingSettings.analyticsSettings;
        const trendDisplay = this.normalizeEnumString(trendSettings.trendDisplay.value, ['delta', 'percent', 'both'], 'both');

        const lines: string[] = [];
        if (trendDisplay === 'delta' || trendDisplay === 'both') {
            lines.push(`${directionArrow} ${this.formatComparisonAbsolute(delta)}`);
        }
        if (trendDisplay === 'percent' || trendDisplay === 'both') {
            lines.push(hasPercent ? this.formatComparisonPercent(deltaPercent as number) : 'N/A');
        }

        const trendColor = delta > 0
            ? trendSettings.trendPositiveColor.value.value
            : delta < 0
                ? trendSettings.trendNegativeColor.value.value
                : trendSettings.trendNeutralColor.value.value;

        const fontSize = this.getEffectiveLabelFontSize(trendSettings.trendFontSize.value);
        const lineHeight = Math.max(12, fontSize + 2);
        const trendPosition = this.normalizeEnumString(trendSettings.trendPosition.value, ['top', 'right', 'bottom', 'left'], 'top');
        const trendGroup = this.container.append('g').classed('trend-indicator', true);

        let x = width / 2;
        let y = -10;
        let anchor: 'start' | 'middle' | 'end' = 'middle';

        if (trendPosition === 'right') {
            x = width + 10;
            y = Math.max(lineHeight, (height / 2) - (((lines.length - 1) * lineHeight) / 2));
            anchor = 'start';
        } else if (trendPosition === 'left') {
            x = -10;
            y = Math.max(lineHeight, (height / 2) - (((lines.length - 1) * lineHeight) / 2));
            anchor = 'end';
        } else if (trendPosition === 'bottom') {
            x = width / 2;
            y = height + lineHeight + 10;
            anchor = 'middle';
        }

        const text = trendGroup.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', anchor)
            .attr('font-size', `${fontSize}px`)
            .attr('font-family', trendSettings.trendFontFamily.value)
            .attr('font-weight', trendSettings.trendBold.value ? 'bold' : 'normal')
            .attr('font-style', trendSettings.trendItalic.value ? 'italic' : 'normal')
            .attr('fill', this.getContrastSafeTextColor(trendColor));

        lines.forEach((line, index) => {
            text.append('tspan')
                .attr('x', x)
                .attr('dy', index === 0 ? 0 : lineHeight)
                .text(line);
        });
    }

    private renderTargetBandState(data: GaugeData, targetValue: number, width: number, height: number, isVertical: boolean): void {
        const band = this.getTargetBandState(data, targetValue);
        if (!band) {
            return;
        }

        const bandGroup = this.container.append('g').classed('target-band-state', true);
        bandGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', band.color)
            .attr('opacity', 0.16)
            .attr('pointer-events', 'none');

        if (this.formattingSettings.analyticsSettings.showTargetBandLabel.value && !this.isSecondaryTextHidden()) {
            const fontSize = this.getEffectiveLabelFontSize(this.formattingSettings.analyticsSettings.trendFontSize.value);
            const labelX = isVertical ? width / 2 : 6;
            const labelY = isVertical ? 14 : Math.max(14, height - 6);

            bandGroup.append('text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', isVertical ? 'middle' : 'start')
                .attr('font-size', `${fontSize}px`)
                .attr('font-family', this.formattingSettings.analyticsSettings.trendFontFamily.value)
                .attr('font-weight', 'bold')
                .attr('fill', this.getContrastSafeTextColor('#333333'))
                .text(band.label);
        }
    }

    private renderCategoryLabel(category: string, width: number, height: number, isVertical: boolean) {
        const categoryGroup = this.container.append('g').classed('category-label', true);
        
        // Get category layout settings
        const fontSize = this.getEffectiveLabelFontSize(this.formattingSettings.categoryLayout.categoryFontSize.value);
        const position = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = this.formattingSettings.categoryLayout.categoryPadding.value;
        const textColor = this.getContrastSafeTextColor(this.formattingSettings.categoryLayout.categoryTextColor.value.value);
        const isBold = this.formattingSettings.categoryLayout.categoryBold.value;
        
        const fontWeight = isBold ? 'bold' : 'normal';
        const lineHeight = Math.max(12, fontSize + 2);
        
        // Position the category label based on selected position
        let x: number, y: number = -(categoryPadding + 4), anchor: string, rotation: number = 0, maxCharsPerLine: number;
        
        switch (position) {
            case 'top-left':
                x = 0;
                anchor = 'start';
                maxCharsPerLine = Math.max(8, Math.min(24, Math.floor(width / (fontSize * 0.58))));
                break;
            case 'top-center':
                x = width / 2;
                anchor = 'middle';
                maxCharsPerLine = Math.max(8, Math.min(28, Math.floor(width / (fontSize * 0.52))));
                break;
            case 'top-right':
                x = width;
                anchor = 'end';
                maxCharsPerLine = Math.max(8, Math.min(24, Math.floor(width / (fontSize * 0.58))));
                break;
            case 'bottom-center':
                x = width / 2;
                y = height + categoryPadding + Math.max(6, lineHeight - 8);
                anchor = 'middle';
                maxCharsPerLine = Math.max(8, Math.min(28, Math.floor(width / (fontSize * 0.52))));
                break;
            case 'bottom-angled-45':
                x = 0;
                y = height + categoryPadding + Math.max(6, lineHeight - 6);
                anchor = 'start';
                rotation = 45;
                maxCharsPerLine = 14;
                break;
            case 'left':
                // Wrapped text block on the left side
                x = -(categoryPadding + 8);
                anchor = 'end';
                maxCharsPerLine = 16;
                break;
            default:
                x = 0;
                anchor = 'start';
                maxCharsPerLine = Math.max(8, Math.min(24, Math.floor(width / (fontSize * 0.58))));
        }

        const lines = this.getCategoryLines(category, width, fontSize, position, maxCharsPerLine);

        if (position === 'left') {
            y = (height / 2) - ((lines.length - 1) * lineHeight / 2);
        } else if (position === 'top-left' || position === 'top-center' || position === 'top-right') {
            y = -((lines.length - 1) * lineHeight) - (categoryPadding + 4);
        }

        const textElement = categoryGroup.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', anchor)
            .attr('font-size', `${fontSize}px`)
            .attr('font-weight', fontWeight)
            .attr('fill', textColor);

        lines.forEach((line, index) => {
            textElement.append('tspan')
                .attr('x', x)
                .attr('dy', index === 0 ? 0 : lineHeight)
                .text(line);
        });
        
        // Apply rotation if needed
        if (rotation !== 0) {
            textElement.attr('transform', `rotate(${rotation}, ${x}, ${y})`);
        }
    }

    private getCategoryLines(category: string, gaugeWidth: number, fontSize: number, position: string, fixedMaxChars?: number): string[] {
        const maxCharsPerLine = fixedMaxChars ?? (() => {
            switch (position) {
                case 'top-center':
                case 'bottom-center':
                    return Math.max(8, Math.min(28, Math.floor(gaugeWidth / (fontSize * 0.52))));
                case 'bottom-angled-45':
                    return 14;
                case 'left':
                    return 16;
                case 'top-left':
                case 'top-right':
                default:
                    return Math.max(8, Math.min(24, Math.floor(gaugeWidth / (fontSize * 0.58))));
            }
        })();

        const words = category.split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (candidate.length <= maxCharsPerLine) {
                currentLine = candidate;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [category];
    }

    private clear() {
        this.container.selectAll('*').remove();
    }

    private renderLandingPage(width: number, height: number) {
        this.clear();
        
        // Set SVG dimensions properly
        this.svg
            .attr('width', Math.max(1, width))
            .attr('height', Math.max(1, height));
        
        const landingPageGroup = this.container.append('g')
            .classed('landing-page', true);
        
        // Center the content
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Draw sample gauge visualization
        const gaugeWidth = Math.min(200, width * 0.6);
        const gaugeHeight = Math.min(150, height * 0.4);
        const gaugeX = centerX - gaugeWidth / 2;
        const gaugeY = centerY - gaugeHeight / 2 - 40;
        
        // Background bar
        landingPageGroup.append('rect')
            .attr('x', gaugeX)
            .attr('y', gaugeY + gaugeHeight * 0.3)
            .attr('width', gaugeWidth)
            .attr('height', gaugeHeight * 0.4)
            .attr('fill', '#e0e0e0')
            .attr('rx', 4)
            .attr('opacity', 0.5);
        
        // Value fill bar
        landingPageGroup.append('rect')
            .attr('x', gaugeX)
            .attr('y', gaugeY + gaugeHeight * 0.35)
            .attr('width', gaugeWidth * 0.7)
            .attr('height', gaugeHeight * 0.3)
            .attr('fill', '#4caf50')
            .attr('rx', 3)
            .attr('opacity', 0.7);
        
        // Target marker
        const targetX = gaugeX + gaugeWidth * 0.85;
        landingPageGroup.append('line')
            .attr('x1', targetX)
            .attr('x2', targetX)
            .attr('y1', gaugeY + gaugeHeight * 0.25)
            .attr('y2', gaugeY + gaugeHeight * 0.75)
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.6);
        
        // Welcome text
        landingPageGroup.append('text')
            .attr('x', centerX)
            .attr('y', gaugeY + gaugeHeight + 50)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .attr('fill', this.getColor('#333'))
            .text('Linear Gauge Visual');
        
        // Instruction text
        landingPageGroup.append('text')
            .attr('x', centerX)
            .attr('y', gaugeY + gaugeHeight + 80)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', this.getColor('#666'))
            .text('Add data to get started');
        
        // Set scroll container to hidden since landing page fits in viewport
        this.scrollContainer.style.overflowX = 'hidden';
        this.scrollContainer.style.overflowY = 'hidden';
    }

    private renderNoDataState(width: number, height: number): void {
        this.clear();
        this.svg
            .attr('width', Math.max(1, width))
            .attr('height', Math.max(1, height))
            .attr('aria-label', 'Linear Gauge visual with no data.');
        this.scrollContainer.style.overflowX = 'hidden';
        this.scrollContainer.style.overflowY = 'hidden';
    }

    /**
     * Get appropriate color for high contrast mode
     */
    private getColor(normalColor: string, colorType: 'foreground' | 'background' | 'selected' = 'foreground'): string {
        if (this.isHighContrast) {
            switch (colorType) {
                case 'foreground':
                    return this.highContrastColors.foreground;
                case 'background':
                    return this.highContrastColors.background;
                case 'selected':
                    return this.highContrastColors.foregroundSelected;
                default:
                    return this.highContrastColors.foreground;
            }
        }
        return normalColor;
    }

    /**
     * Get stroke width appropriate for high contrast mode
     */
    private getStrokeWidth(normalWidth: number): number {
        return this.isHighContrast ? Math.max(normalWidth, 2) : normalWidth;
    }

    private formatValue(value: number): string {
        const formatType = this.getNormalizedValueFormatPreset();
        const decimalPlaces = this.formattingSettings.valueFormatting.valueDecimalPlaces.value;
        const prefix = this.formattingSettings.valueFormatting.valuePrefix?.value ?? "";
        const suffix = this.formattingSettings.valueFormatting.valueSuffix?.value ?? "";
        const locale = this.getLocale();

        const resolvedPreset = formatType === 'auto'
            ? (Math.abs(value) >= 1000 ? 'compact' : 'number')
            : formatType;

        let formattedValue: string;
        if (resolvedPreset === 'percent') {
            const formatter = new Intl.NumberFormat(locale, {
                style: 'percent',
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
            formattedValue = formatter.format(value / 100);
        } else if (resolvedPreset === 'currency') {
            const formatter = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
            formattedValue = formatter.format(value);
        } else if (resolvedPreset === 'compact') {
            const formatter = new Intl.NumberFormat(locale, {
                notation: 'compact',
                compactDisplay: 'short',
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
            formattedValue = formatter.format(value);
        } else {
            const formatter = new Intl.NumberFormat(locale, {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
            formattedValue = formatter.format(value);
        }
        
        return prefix + formattedValue + suffix;
    }

    private getNormalizedValueFormatPreset(): string {
        const rawFormat = this.formattingSettings.valueFormatting.valueFormat.value.value as string;
        if (rawFormat === 'decimal') return 'number';
        if (rawFormat === 'percentage') return 'percent';
        return rawFormat;
    }

    private getLocale(): string {
        return (this.host as any)?.locale || navigator.language || 'en-US';
    }

    private formatComparisonAbsolute(delta: number): string {
        const decimalPlaces = this.formattingSettings.valueFormatting.valueDecimalPlaces.value;
        const format = new Intl.NumberFormat(this.getLocale(), {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
            signDisplay: 'always'
        });
        return format.format(delta);
    }

    private formatComparisonPercent(deltaPercent: number): string {
        const decimalPlaces = this.formattingSettings.valueFormatting.valueDecimalPlaces.value;
        const format = new Intl.NumberFormat(this.getLocale(), {
            style: 'percent',
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
            signDisplay: 'always'
        });
        return format.format(deltaPercent);
    }

    private getComparisonLines(delta: number, deltaPercent: number | null, comparisonDisplay: string): string[] {
        if (comparisonDisplay === 'off') {
            return [];
        }

        const absoluteText = this.formatComparisonAbsolute(delta);
        const percentText = deltaPercent !== null ? this.formatComparisonPercent(deltaPercent) : 'N/A';

        if (comparisonDisplay === 'absolute') {
            return [absoluteText];
        }

        if (comparisonDisplay === 'percent') {
            return [percentText];
        }

        return [absoluteText, percentText];
    }

    private getEstimatedTextWidth(text: string, fontSize: number): number {
        return Math.max(0, Math.ceil(text.length * fontSize * 0.62));
    }

    private getTargetBandState(data: GaugeData, targetValue: number): { state: 'below' | 'near' | 'above'; color: string; label: string } | null {
        if (!Number.isFinite(targetValue)) {
            return null;
        }

        const tolerancePct = Math.max(0, this.formattingSettings.analyticsSettings.targetBandTolerancePercent.value) / 100;
        const toleranceAmount = Math.abs(targetValue) * tolerancePct;
        const lowerBound = targetValue - toleranceAmount;
        const upperBound = targetValue + toleranceAmount;

        // Deterministic boundary rules:
        // - Below: value < lowerBound
        // - Near:  lowerBound <= value <= upperBound
        // - Above: value > upperBound
        if (data.value < lowerBound) {
            return {
                state: 'below',
                color: this.formattingSettings.analyticsSettings.belowTargetColor.value.value,
                label: this.formattingSettings.analyticsSettings.belowTargetLabel.value || 'Below'
            };
        }

        if (data.value > upperBound) {
            return {
                state: 'above',
                color: this.formattingSettings.analyticsSettings.aboveTargetColor.value.value,
                label: this.formattingSettings.analyticsSettings.aboveTargetLabel.value || 'Above'
            };
        }

        return {
            state: 'near',
            color: this.formattingSettings.analyticsSettings.nearTargetColor.value.value,
            label: this.formattingSettings.analyticsSettings.nearTargetLabel.value || 'Near'
        };
    }

    private getTrendMetrics(data: GaugeData): { lineCount: number; maxLineWidth: number; position: string } {
        if (!this.formattingSettings.analyticsSettings.showTrendIndicator.value || data.previousValue === null || this.isSecondaryTextHidden()) {
            return { lineCount: 0, maxLineWidth: 0, position: 'top' };
        }

        const delta = data.value - data.previousValue;
        const hasPercent = data.previousValue !== 0;
        const trendDisplay = this.normalizeEnumString(this.formattingSettings.analyticsSettings.trendDisplay.value, ['delta', 'percent', 'both'], 'both');
        const lines: string[] = [];

        if (trendDisplay === 'delta' || trendDisplay === 'both') {
            lines.push(this.formatComparisonAbsolute(delta));
        }
        if (trendDisplay === 'percent' || trendDisplay === 'both') {
            lines.push(hasPercent ? this.formatComparisonPercent(delta / data.previousValue) : 'N/A');
        }

        const fontSize = this.getEffectiveLabelFontSize(this.formattingSettings.analyticsSettings.trendFontSize.value);
        const maxLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, this.getEstimatedTextWidth(line, fontSize) + fontSize), 0);
        const position = this.normalizeEnumString(this.formattingSettings.analyticsSettings.trendPosition.value, ['top', 'right', 'bottom', 'left'], 'top');
        return { lineCount: lines.length, maxLineWidth, position };
    }

    private isCompactModeEnabled(): boolean {
        return this.formattingSettings.uxAccessibility.compactMode.value;
    }

    private getLayoutDensityFactor(): number {
        return this.isCompactModeEnabled() ? 0.6 : 1;
    }

    private isSecondaryTextHidden(): boolean {
        return this.formattingSettings.uxAccessibility.hideSecondaryText.value;
    }

    private isAnimationDisabled(): boolean {
        return this.formattingSettings.uxAccessibility.disableAnimations.value;
    }

    private getMinimumLabelFontSize(): number {
        return Math.max(8, Math.floor(this.formattingSettings.uxAccessibility.minLabelFontSize.value));
    }

    private getEffectiveLabelFontSize(configuredSize: number): number {
        return Math.max(this.getMinimumLabelFontSize(), Math.floor(configuredSize));
    }

    private getContrastSafeTextColor(configuredColor: string): string {
        if (this.isHighContrast) {
            return this.getColor(configuredColor, 'foreground');
        }
        return configuredColor;
    }

    private applyRootAriaLabel(gaugesData: GaugeData[]): void {
        const total = gaugesData.length;
        const categories = gaugesData
            .map((item) => item.category)
            .filter((item) => item !== null)
            .length;
        const summary = `${total} gauge${total === 1 ? '' : 's'} rendered${categories > 0 ? ` across ${categories} categor${categories === 1 ? 'y' : 'ies'}` : ''}.`;
        this.svg.attr('aria-label', `Linear Gauge visual. ${summary} Use Tab to focus and Escape to clear selection.`);
    }

    private getGaugeAriaLabel(data: GaugeData, index: number, total: number): string {
        const categoryPart = data.category ? `Category ${data.category}. ` : '';
        const targetValue = this.getEffectiveTargetValue(data);
        const targetPart = targetValue !== null ? `Target ${this.formatThresholdValue(targetValue)}. ` : '';
        const trendPart = data.previousValue !== null ? `Previous ${this.formatValue(data.previousValue)}. ` : '';
        const bandPart = (this.formattingSettings.analyticsSettings.showTargetBands.value && targetValue !== null)
            ? `Band ${this.getTargetBandState(data, targetValue)?.label || 'Unknown'}. `
            : '';
        return `Gauge ${index + 1} of ${total}. ${categoryPart}Value ${this.formatValue(data.value)}. ${trendPart}Range ${this.formatThresholdValue(data.minimum)} to ${this.formatThresholdValue(data.maximum)}. ${targetPart}${bandPart}`;
    }

    private getGaugeLeftMargin(data: GaugeData, isVertical: boolean): number {
        const scaleLabelWidth = this.getScaleLabelWidth(data);
        let leftMargin = isVertical ? 62 : 40;

        const trendMetrics = this.getTrendMetrics(data);
        if (trendMetrics.lineCount > 0 && trendMetrics.position === 'left') {
            leftMargin = Math.max(leftMargin, 18 + trendMetrics.maxLineWidth);
        }

        const comparisonMetrics = this.getComparisonMetrics(data);
        if (!this.isSecondaryTextHidden() && comparisonMetrics.lineCount > 0 && this.getComparisonPosition() === 'left') {
            leftMargin = Math.max(leftMargin, 24 + comparisonMetrics.maxLineWidth);
        }

        if (!this.isSecondaryTextHidden() && scaleLabelWidth > 0) {
            leftMargin = Math.max(leftMargin, 16 + scaleLabelWidth);
        }

        leftMargin = Math.max(16, Math.round(leftMargin * this.getLayoutDensityFactor()));

        if (!isVertical) {
            return leftMargin;
        }

        const valueLabelPosition = this.formattingSettings.valueFormatting.valueLabelPosition.value.value as string;
        if (this.formattingSettings.valueFormatting.showLabels.value && valueLabelPosition === 'left') {
            leftMargin = Math.max(leftMargin, 24 + this.getEstimatedTextWidth(this.formatValue(data.value), this.formattingSettings.valueFormatting.valueFontSize.value));
        }

        return leftMargin;
    }

    private getGaugeRightMargin(data: GaugeData, isVertical: boolean): number {
        let rightMargin = 20;

        const trendMetrics = this.getTrendMetrics(data);
        if (trendMetrics.lineCount > 0 && trendMetrics.position === 'right') {
            rightMargin = Math.max(rightMargin, 18 + trendMetrics.maxLineWidth);
        }

        const comparisonMetrics = this.getComparisonMetrics(data);
        if (!this.isSecondaryTextHidden() && comparisonMetrics.lineCount > 0 && this.getComparisonPosition() === 'right') {
            rightMargin = Math.max(rightMargin, 24 + comparisonMetrics.maxLineWidth);
        }

        if (isVertical) {
            const valueLabelPosition = this.formattingSettings.valueFormatting.valueLabelPosition.value.value as string;
            if (this.formattingSettings.valueFormatting.showLabels.value && valueLabelPosition === 'right') {
                rightMargin = Math.max(rightMargin, 24 + this.getEstimatedTextWidth(this.formatValue(data.value), this.formattingSettings.valueFormatting.valueFontSize.value));
            }
        }

        if (!this.isSecondaryTextHidden() && this.formattingSettings.colorZones.showThresholdLabels.value && this.formattingSettings.categoryLayout.categoryPosition.value.value === 'left') {
            const thresholdWidth = this.getThresholdBoundaryValues(data)
                .map((value) => this.truncateThresholdLabel(this.formatThresholdValue(value), Math.max(1, Math.floor(this.formattingSettings.colorZones.thresholdMaxLabelLength.value))))
                .reduce((maxWidth, label) => Math.max(maxWidth, this.getEstimatedTextWidth(label, this.formattingSettings.colorZones.thresholdFontSize.value)), 0);
            rightMargin = Math.max(rightMargin, 20 + thresholdWidth);
        }

        rightMargin = Math.max(12, Math.round(rightMargin * this.getLayoutDensityFactor()));

        return rightMargin;
    }

    private getGaugeBottomMargin(
        data: GaugeData,
        isVertical: boolean,
        categoryBlockHeight: number,
        categoryPadding: number,
        categoryPosition: string,
        showCategoryLabel: boolean
    ): number {
        const compactFactor = this.getLayoutDensityFactor();
        let bottomMargin = (showCategoryLabel && (categoryPosition === 'bottom-center' || categoryPosition === 'bottom-angled-45'))
            ? (categoryPadding + categoryBlockHeight + 10)
            : 24;

        const trendMetrics = this.getTrendMetrics(data);
        if (trendMetrics.lineCount > 0 && trendMetrics.position === 'bottom') {
            bottomMargin += (trendMetrics.lineCount * Math.max(12, this.getEffectiveLabelFontSize(this.formattingSettings.analyticsSettings.trendFontSize.value) + 2)) + 12;
        }

        const comparisonMetrics = this.getComparisonMetrics(data);
        if (!this.isSecondaryTextHidden() && comparisonMetrics.lineCount > 0 && this.getComparisonPosition() === 'bottom') {
            bottomMargin += (comparisonMetrics.lineCount * Math.max(12, this.formattingSettings.targetSettings.comparisonFontSize.value + 2)) + 14;
        }

        return Math.max(14, Math.round(bottomMargin * compactFactor));
    }

    private shouldShowScaleLabel(which: 'min' | 'max'): boolean {
        const scaleLabelDisplay = this.getScaleLabelDisplayValue();

        if (scaleLabelDisplay === 'both') {
            return true;
        }

        if (scaleLabelDisplay === 'off') {
            return false;
        }

        return scaleLabelDisplay === which;
    }

    private getScaleLabelDisplayValue(): string {
        return this.normalizeEnumString(
            this.formattingSettings.colorZones.scaleLabelDisplay.value,
            ['off', 'min', 'max', 'both'],
            'both'
        );
    }

    private getComparisonPosition(): string {
        return this.normalizeEnumString(
            this.formattingSettings.targetSettings.comparisonPosition.value,
            ['top', 'left', 'right', 'bottom'],
            'bottom'
        );
    }

    private normalizeEnumString(rawValue: unknown, orderedValues: string[], fallback: string): string {
        if (typeof rawValue === 'string') {
            return orderedValues.includes(rawValue) ? rawValue : fallback;
        }

        if (typeof rawValue === 'number' && Number.isInteger(rawValue)) {
            return orderedValues[rawValue] ?? fallback;
        }

        if (rawValue && typeof rawValue === 'object' && 'value' in (rawValue as any)) {
            return this.normalizeEnumString((rawValue as any).value, orderedValues, fallback);
        }

        return fallback;
    }

    private getComparisonMetrics(data: GaugeData): { lineCount: number; maxLineWidth: number } {
        if (this.isSecondaryTextHidden()) {
            return { lineCount: 0, maxLineWidth: 0 };
        }

        if (!this.formattingSettings.targetSettings.showComparison.value) {
            return { lineCount: 0, maxLineWidth: 0 };
        }

        const comparisonDisplay = this.formattingSettings.targetSettings.comparisonDisplay.value.value as string;
        if (comparisonDisplay === 'off') {
            return { lineCount: 0, maxLineWidth: 0 };
        }

        const effectiveTarget = this.getEffectiveTargetValue(data);
        if (effectiveTarget === null) {
            return { lineCount: 0, maxLineWidth: 0 };
        }

        const delta = data.value - effectiveTarget;
        const deltaPercent = effectiveTarget !== 0 ? (delta / effectiveTarget) : null;
        const lines = this.getComparisonLines(delta, deltaPercent, comparisonDisplay);
        const fontSize = this.formattingSettings.targetSettings.comparisonFontSize.value;
        const maxLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, this.getEstimatedTextWidth(line, fontSize)), 0);

        return { lineCount: lines.length, maxLineWidth };
    }

    private getScaleLabelWidth(data: GaugeData): number {
        const thresholdFontSize = this.getEffectiveLabelFontSize(this.formattingSettings.colorZones.thresholdFontSize.value);
        const labels: string[] = [];

        if (this.shouldShowScaleLabel('min')) {
            labels.push(this.formatThresholdValue(data.minimum));
        }

        if (this.shouldShowScaleLabel('max')) {
            labels.push(this.formatThresholdValue(data.maximum));
        }

        return labels.reduce((maxWidth, label) => Math.max(maxWidth, this.getEstimatedTextWidth(label, thresholdFontSize)), 0);
    }

    private truncateThresholdLabel(value: string, maxLength: number): string {
        if (maxLength <= 0 || value.length <= maxLength) {
            return value;
        }
        if (maxLength <= 3) {
            return value.substring(0, maxLength);
        }
        return `${value.substring(0, maxLength - 3)}...`;
    }

    private getThresholdLineDashArray(lineStyle: string): string | null {
        if (lineStyle === 'dashed') return '4,3';
        if (lineStyle === 'dotted') return '1,3';
        return null;
    }

    private formatThresholdValue(value: number): string {
        // Threshold values use their own decimal places setting, no prefix/suffix
        const decimalPlaces = this.formattingSettings?.colorZones?.thresholdDecimalPlaces?.value;
        const places = (decimalPlaces !== undefined && decimalPlaces !== null) ? decimalPlaces : 0;
        const formatString = `,.${places}f`;
        return d3.format(formatString)(value);
    }

    private getThresholdBoundaryValues(data: GaugeData): number[] {
        const settings = this.formattingSettings.colorZones;
        const thresholdMode = settings.thresholdMode.value.value as string;

        let boundaries: number[];
        if (thresholdMode === 'absolute'
            && data.threshold1 !== null
            && data.threshold2 !== null
            && data.threshold3 !== null
            && data.threshold4 !== null) {
            boundaries = [data.threshold1, data.threshold2, data.threshold3, data.threshold4];
        } else {
            const range = data.maximum - data.minimum;
            boundaries = [
                data.minimum + (range * settings.threshold1.value / 100),
                data.minimum + (range * settings.threshold2.value / 100),
                data.minimum + (range * settings.threshold3.value / 100),
                data.minimum + (range * settings.threshold4.value / 100)
            ];
        }

        return boundaries
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => left - right);
    }

    private getEffectiveTargetValue(data: GaugeData): number | null {
        const nextThreshold = this.getThresholdBoundaryValues(data).find((boundary) => boundary > data.value);

        if (nextThreshold !== undefined) {
            return nextThreshold;
        }

        if (data.value < data.maximum) {
            return data.maximum;
        }

        return data.target;
    }

    private getTooltipData(data: GaugeData): VisualTooltipDataItem[] {
        // Show tooltips only when user provides values in Tooltip Value role.
        return data.customTooltips;
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
    
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        const instances: VisualObjectInstance[] = [];

        switch (options.objectName) {
            case "gaugeSettings":
                instances.push({
                    objectName: "gaugeSettings",
                    properties: {
                        orientation: this.formattingSettings.gaugeSettings.orientation.value,
                        showCategoryLabel: this.formattingSettings.gaugeSettings.showCategoryLabel.value,
                        animationDuration: this.formattingSettings.gaugeSettings.animationDuration.value,
                        layout: this.formattingSettings.gaugeSettings.layout.value,
                        gaugeWidth: this.formattingSettings.gaugeSettings.gaugeWidth.value,
                        gaugePadding: this.formattingSettings.gaugeSettings.gaugePadding.value,
                        gaugeVerticalPadding: this.formattingSettings.gaugeSettings.gaugeVerticalPadding.value,
                        maxGaugesPerRow: this.formattingSettings.gaugeSettings.maxGaugesPerRow.value,
                        maxGaugesPerColumn: this.formattingSettings.gaugeSettings.maxGaugesPerColumn.value,
                        fillThicknessFactor: this.formattingSettings.gaugeSettings.fillThicknessFactor.value,
                        useStaticValueColor: this.formattingSettings.gaugeSettings.useStaticValueColor.value,
                        staticValueColor: this.formattingSettings.gaugeSettings.staticValueColor.value
                    },
                    selector: undefined as any
                });
                break;
            case "valueFormatting":
                instances.push({
                    objectName: "valueFormatting",
                    properties: {
                        showLabels: this.formattingSettings.valueFormatting.showLabels.value,
                        valueLabelPosition: this.formattingSettings.valueFormatting.valueLabelPosition.value,
                        valueFormat: this.formattingSettings.valueFormatting.valueFormat.value,
                        valueDecimalPlaces: this.formattingSettings.valueFormatting.valueDecimalPlaces.value,
                        valuePrefix: this.formattingSettings.valueFormatting.valuePrefix.value,
                        valueSuffix: this.formattingSettings.valueFormatting.valueSuffix.value,
                        valueFontSize: this.formattingSettings.valueFormatting.valueFontSize.value,
                        valueFontFamily: this.formattingSettings.valueFormatting.valueFontFamily.value,
                        valueLabelColor: this.formattingSettings.valueFormatting.valueLabelColor.value,
                        valueBold: this.formattingSettings.valueFormatting.valueBold.value,
                        valueItalic: this.formattingSettings.valueFormatting.valueItalic.value
                    },
                    selector: undefined as any
                });
                break;
            case "categoryLayout":
                instances.push({
                    objectName: "categoryLayout",
                    properties: {
                        categoryFontSize: this.formattingSettings.categoryLayout.categoryFontSize.value,
                        categoryPosition: this.formattingSettings.categoryLayout.categoryPosition.value,
                        categoryTextColor: this.formattingSettings.categoryLayout.categoryTextColor.value,
                        categoryPadding: this.formattingSettings.categoryLayout.categoryPadding.value,
                        categoryBold: this.formattingSettings.categoryLayout.categoryBold.value
                    },
                    selector: undefined as any
                });
                break;
            case "colorZones":
                instances.push({
                    objectName: "colorZones",
                    properties: {
                        thresholdMode: this.formattingSettings.colorZones.thresholdMode.value,
                        threshold1: this.formattingSettings.colorZones.threshold1.value,
                        threshold2: this.formattingSettings.colorZones.threshold2.value,
                        threshold3: this.formattingSettings.colorZones.threshold3.value,
                        threshold4: this.formattingSettings.colorZones.threshold4.value,
                        redColor: this.formattingSettings.colorZones.redColor.value,
                        yellowColor: this.formattingSettings.colorZones.yellowColor.value,
                        greenColor: this.formattingSettings.colorZones.greenColor.value,
                        lightBlueColor: this.formattingSettings.colorZones.lightBlueColor.value,
                        showThresholdLabels: this.formattingSettings.colorZones.showThresholdLabels.value,
                        showThreshold1Label: this.formattingSettings.colorZones.showThreshold1Label.value,
                        showThreshold2Label: this.formattingSettings.colorZones.showThreshold2Label.value,
                        showThreshold3Label: this.formattingSettings.colorZones.showThreshold3Label.value,
                        showThreshold4Label: this.formattingSettings.colorZones.showThreshold4Label.value,
                        scaleLabelDisplay: this.formattingSettings.colorZones.scaleLabelDisplay.value,
                        thresholdMaxLabelLength: this.formattingSettings.colorZones.thresholdMaxLabelLength.value,
                        thresholdLineStyle: this.formattingSettings.colorZones.thresholdLineStyle.value,
                        thresholdFontSize: this.formattingSettings.colorZones.thresholdFontSize.value,
                        thresholdFontFamily: this.formattingSettings.colorZones.thresholdFontFamily.value,
                        thresholdDecimalPlaces: this.formattingSettings.colorZones.thresholdDecimalPlaces.value,
                        thresholdLabelColor: this.formattingSettings.colorZones.thresholdLabelColor.value,
                        thresholdBold: this.formattingSettings.colorZones.thresholdBold.value,
                        thresholdItalic: this.formattingSettings.colorZones.thresholdItalic.value
                    },
                    selector: undefined as any
                });
                break;
            case "targetSettings":
                instances.push({
                    objectName: "targetSettings",
                    properties: {
                        showTarget: this.formattingSettings.targetSettings.showTarget.value,
                        targetColor: this.formattingSettings.targetSettings.targetColor.value,
                        showComparison: this.formattingSettings.targetSettings.showComparison.value,
                        comparisonDisplay: this.formattingSettings.targetSettings.comparisonDisplay.value,
                        comparisonPosition: this.formattingSettings.targetSettings.comparisonPosition.value,
                        comparisonPositiveColor: this.formattingSettings.targetSettings.comparisonPositiveColor.value,
                        comparisonNegativeColor: this.formattingSettings.targetSettings.comparisonNegativeColor.value,
                        comparisonFontSize: this.formattingSettings.targetSettings.comparisonFontSize.value,
                        comparisonFontFamily: this.formattingSettings.targetSettings.comparisonFontFamily.value,
                        comparisonBold: this.formattingSettings.targetSettings.comparisonBold.value,
                        comparisonItalic: this.formattingSettings.targetSettings.comparisonItalic.value
                    },
                    selector: undefined as any
                });
                break;
            case "uxAccessibility":
                instances.push({
                    objectName: "uxAccessibility",
                    properties: {
                        compactMode: this.formattingSettings.uxAccessibility.compactMode.value,
                        hideSecondaryText: this.formattingSettings.uxAccessibility.hideSecondaryText.value,
                        disableAnimations: this.formattingSettings.uxAccessibility.disableAnimations.value,
                        minLabelFontSize: this.formattingSettings.uxAccessibility.minLabelFontSize.value,
                        focusRingColor: this.formattingSettings.uxAccessibility.focusRingColor.value
                    },
                    selector: undefined as any
                });
                break;
            case "analyticsSettings":
                instances.push({
                    objectName: "analyticsSettings",
                    properties: {
                        showTrendIndicator: this.formattingSettings.analyticsSettings.showTrendIndicator.value,
                        trendDisplay: this.formattingSettings.analyticsSettings.trendDisplay.value,
                        trendPosition: this.formattingSettings.analyticsSettings.trendPosition.value,
                        trendPositiveColor: this.formattingSettings.analyticsSettings.trendPositiveColor.value,
                        trendNegativeColor: this.formattingSettings.analyticsSettings.trendNegativeColor.value,
                        trendNeutralColor: this.formattingSettings.analyticsSettings.trendNeutralColor.value,
                        trendFontSize: this.formattingSettings.analyticsSettings.trendFontSize.value,
                        trendFontFamily: this.formattingSettings.analyticsSettings.trendFontFamily.value,
                        trendBold: this.formattingSettings.analyticsSettings.trendBold.value,
                        trendItalic: this.formattingSettings.analyticsSettings.trendItalic.value,
                        showTargetBands: this.formattingSettings.analyticsSettings.showTargetBands.value,
                        targetBandTolerancePercent: this.formattingSettings.analyticsSettings.targetBandTolerancePercent.value,
                        showTargetBandLabel: this.formattingSettings.analyticsSettings.showTargetBandLabel.value,
                        belowTargetColor: this.formattingSettings.analyticsSettings.belowTargetColor.value,
                        nearTargetColor: this.formattingSettings.analyticsSettings.nearTargetColor.value,
                        aboveTargetColor: this.formattingSettings.analyticsSettings.aboveTargetColor.value,
                        belowTargetLabel: this.formattingSettings.analyticsSettings.belowTargetLabel.value,
                        nearTargetLabel: this.formattingSettings.analyticsSettings.nearTargetLabel.value,
                        aboveTargetLabel: this.formattingSettings.analyticsSettings.aboveTargetLabel.value
                    },
                    selector: undefined as any
                });
                break;
        }

        return instances;
    }

    public destroy(): void {
        // Cleanup
    }
}
