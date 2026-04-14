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
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import IColorPalette = powerbi.extensibility.IColorPalette;

import { VisualFormattingSettingsModel } from "./settings";

interface GaugeData {
    category: string | null;
    value: number;
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
    }

    public update(options: VisualUpdateOptions) {
        try {
            // Signal rendering start
            this.host.eventService?.renderingStarted(options);

            const updateOptions = options as VisualUpdateOptions & { allowInteractions?: boolean };
            this.allowInteractions = updateOptions.allowInteractions !== false;

            // Get formatting settings
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel, 
                options.dataViews?.[0]
            );
            
            // Get color palette from host
            this.colorPalette = this.host.colorPalette;
            
            // Detect high contrast mode
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
            
            // Update color zones slices based on threshold mode
            this.formattingSettings.colorZones.populateSlices();
            
            // Get viewport dimensions
            const width = options.viewport.width;
            const height = options.viewport.height;
            
            // Extract data from dataViews
            const dataView = options.dataViews?.[0];
            if (!dataView) {
                this.renderLandingPage(width, height);
                this.host.eventService?.renderingFinished(options);
                return;
            }

            const gaugeDataArray = this.extractData(dataView);
            if (gaugeDataArray === null || gaugeDataArray.length === 0) {
                this.renderLandingPage(width, height);
                this.host.eventService?.renderingFinished(options);
                return;
            }
            
            // Render the gauges
            this.renderMultipleGauges(gaugeDataArray, width, height);

            // Signal rendering complete
            this.host.eventService?.renderingFinished(options);
            
        } catch (error) {
            console.error('Error in update:', error);
            this.clear();
            // Signal rendering complete even on error
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
        const gaugeWidthSetting = settings.gaugeWidth.value;
        const gaugeCount = gaugesData.length;
        const configuredPadding = this.formattingSettings.gaugeSettings.gaugePadding.value;
        const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = this.formattingSettings.categoryLayout.categoryPadding.value;
        const showCategoryLabel = this.formattingSettings.gaugeSettings.showCategoryLabel.value;
        const padding = Math.max(0, configuredPadding);
        const categoryFontSize = this.formattingSettings.categoryLayout.categoryFontSize.value;
        const maxCategoryLines = showCategoryLabel
            ? gaugesData.reduce((maxLines, gauge) => {
                if (!gauge.category) return maxLines;
                const lines = this.getCategoryLines(gauge.category, gaugeWidthSetting, categoryFontSize, categoryPosition).length;
                return Math.max(maxLines, lines);
            }, 1)
            : 1;
        const categoryBlockHeight = Math.max(12, categoryFontSize + 2) * Math.max(1, maxCategoryLines);
        const topMargin = (showCategoryLabel && categoryPosition.startsWith('top'))
            ? (categoryPadding + categoryBlockHeight + 10)
            : 16;
        const bottomMargin = (showCategoryLabel && (categoryPosition === 'bottom-center' || categoryPosition === 'bottom-angled-45'))
            ? (categoryPadding + categoryBlockHeight + 10)
            : 24;
        
        if (gaugeCount === 0) return;
        
        // Calculate layout dimensions
        const gaugeWidth = Math.max(40, gaugeWidthSetting);
        const cols = gaugeCount;
        const requiredWidth = cols * gaugeWidth + Math.max(0, cols - 1) * padding;
        const horizontalScrollbarClearance = requiredWidth > (width + 1) ? 16 : 0;
        const minimumBodyHeight = 80;
        const minimumSlotHeight = minimumBodyHeight + topMargin + bottomMargin;
        // Stretch the gauge slot to the viewport height so gauges grow when the visual is made taller.
        const gaugeHeightCalc = Math.max(minimumSlotHeight + horizontalScrollbarClearance, Math.max(1, height));

        // Start at viewport size; after rendering, resize to actual drawn bounds.
        this.svg
            .attr('width', Math.max(1, width))
            .attr('height', Math.max(1, height));

        const xStart = 0;
        
        // Render each gauge
        for (let i = 0; i < gaugeCount; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            // Add padding to positions
            const x = xStart + col * (gaugeWidth + padding);
            const y = row * (gaugeHeightCalc + padding);
            
            // Create a group for this gauge
            const gaugeGroup = this.container.append('g')
                .classed('gauge-item', true)
                .attr('transform', `translate(${x}, ${y})`);

            const gaugeData = gaugesData[i];
            if (this.allowInteractions && gaugeData.selectionId) {
                gaugeGroup.style('cursor', 'pointer');
                gaugeGroup.on('click', (event: MouseEvent) => {
                    event.stopPropagation();
                    this.selectionManager.select(gaugeData.selectionId as ISelectionId, event.ctrlKey);
                });
                // Add context menu support for individual gauge
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
            
            // Temporarily set container to this gaugeGroup
            const originalContainer = this.container;
            this.container = gaugeGroup;
            
            // Render the individual gauge
            this.render(gaugeData, gaugeWidth, gaugeHeightCalc, maxCategoryLines, horizontalScrollbarClearance);
            
            // Restore original container
            this.container = originalContainer;
        }

        // Match SVG size to actual rendered content so scrollbars only appear on real overflow.
        const containerNode = this.container.node();
        if (containerNode) {
            const bounds = containerNode.getBBox();
            const drawnWidth = Math.max(0, Math.ceil(bounds.x + bounds.width));
            const drawnHeight = Math.max(0, Math.ceil(bounds.y + bounds.height));
            const finalWidth = Math.max(width, drawnWidth || requiredWidth);
            const finalHeight = Math.max(height, drawnHeight || gaugeHeightCalc);
            const overflowEpsilon = 1;
            const hasHorizontalOverflow = finalWidth > (width + overflowEpsilon);
            const hasVerticalOverflow = finalHeight > (height + overflowEpsilon);

            this.svg
                .attr('width', finalWidth)
                .attr('height', finalHeight);

            // Toggle each axis explicitly to avoid host/browser showing scrollbars when not needed.
            this.scrollContainer.style.overflowX = hasHorizontalOverflow ? 'auto' : 'hidden';
            this.scrollContainer.style.overflowY = hasVerticalOverflow ? 'auto' : 'hidden';
        } else {
            // Fallback: use required width and viewport height assumptions.
            this.scrollContainer.style.overflowX = requiredWidth > (width + 1) ? 'auto' : 'hidden';
            this.scrollContainer.style.overflowY = 'hidden';
        }
    }

    private render(data: GaugeData, width: number, height: number, fixedCategoryLineCount?: number, bottomOverlayOffset: number = 0) {
        const settings = this.formattingSettings;
        const isVertical = settings.gaugeSettings.orientation.value.value === 'vertical';
        const showCategoryLabel = settings.gaugeSettings.showCategoryLabel.value;
        const categoryPosition = settings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = settings.categoryLayout.categoryPadding.value;
        const configuredGaugeWidth = settings.gaugeSettings.gaugeWidth.value;
        const categoryFontSize = settings.categoryLayout.categoryFontSize.value;
        const categoryLineCount = fixedCategoryLineCount ?? ((showCategoryLabel && data.category)
            ? this.getCategoryLines(data.category, width, categoryFontSize, categoryPosition).length
            : 1);
        const categoryBlockHeight = Math.max(12, categoryFontSize + 2) * Math.max(1, categoryLineCount);
        
        // Define margins and dimensions with extra space for left-side labels/ticks and category placement
        const margin = {
            top: (showCategoryLabel && categoryPosition.startsWith('top')) ? (categoryPadding + categoryBlockHeight + 10) : 16,
            right: 20,
            bottom: ((showCategoryLabel && (categoryPosition === 'bottom-center' || categoryPosition === 'bottom-angled-45'))
                ? (categoryPadding + categoryBlockHeight + 10)
                : 24) + bottomOverlayOffset,
            left: isVertical ? 62 : 40
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
        
        // Render target marker if enabled and target exists
        if (settings.targetSettings.showTarget.value && data.target !== null) {
            this.renderTargetMarker(data, scale, gaugeWidth, gaugeHeight, isVertical);
        }
        
        // Render labels if enabled
        if (settings.valueFormatting.showLabels.value) {
            const formatType = settings.valueFormatting.valueFormat.value.value as string;
            this.renderLabels(data, scale, gaugeWidth, gaugeHeight, isVertical, margin, formatType);
        }
        
        // Render comparison indicator if enabled and target exists
        if (settings.targetSettings.showComparison.value && data.target !== null) {
            this.renderComparison(data, gaugeWidth, gaugeHeight, isVertical, margin);
        }
        
        // Render category label if enabled and category exists
        if (settings.gaugeSettings.showCategoryLabel.value && data.category !== null) {
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
        
        // Render threshold labels if enabled
        if (settings.showThresholdLabels.value) {
            const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
            const thresholdOnRight = isVertical && categoryPosition === 'left';
            const thresholdFontSize = settings.thresholdFontSize.value;
            const thresholdFontFamily = settings.thresholdFontFamily.value;
            const thresholdLabelColor = settings.thresholdLabelColor.value.value;
            const thresholdBold = settings.thresholdBold.value;
            const thresholdItalic = settings.thresholdItalic.value;
            
            // Show all 4 threshold boundaries
            const thresholds = [
                { value: threshold1, label: this.formatThresholdValue(threshold1), position: 0 },
                { value: threshold2, label: this.formatThresholdValue(threshold2), position: 0 },
                { value: threshold3, label: this.formatThresholdValue(threshold3), position: 0 },
                { value: threshold4, label: this.formatThresholdValue(threshold4), position: 0 }
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
                        .attr('stroke-width', 1);

                    // Vertical: labels on opposite side when left category labels are used
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
                } else {
                    thresholdLabelsGroup.append('line')
                        .attr('x1', threshold.position)
                        .attr('x2', threshold.position)
                        .attr('y1', 0)
                        .attr('y2', -6)
                        .attr('stroke', this.getColor('#777'))
                        .attr('stroke-width', 1);

                    // Horizontal: labels above at threshold positions
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
            });
        }
    }

    private renderFillBar(data: GaugeData, scale: d3.ScaleLinear<number, number>, 
                         width: number, height: number, isVertical: boolean) {
        const fillSize = scale(data.value) - scale(data.minimum);
        const animationDuration = this.formattingSettings.gaugeSettings.animationDuration.value;
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
                .attr('opacity', 0.75);

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
                .attr('opacity', 0.75);

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

    private renderTargetMarker(data: GaugeData, scale: d3.ScaleLinear<number, number>, 
                               width: number, height: number, isVertical: boolean) {
        if (data.target === null) return;

        const targetValue = data.target;
        const targetPos = scale(targetValue);
        const markerColor = this.formattingSettings.targetSettings.targetColor.value.value;
        
        const markerGroup = this.container.append('g').classed('target-marker', true);
        
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
        const valueFontSize = this.formattingSettings.valueFormatting.valueFontSize.value;
        const valueFontFamily = this.formattingSettings.valueFormatting.valueFontFamily.value;
        const valueLabelColor = this.formattingSettings.valueFormatting.valueLabelColor.value.value;
        const valueBold = this.formattingSettings.valueFormatting.valueBold.value;
        const valueItalic = this.formattingSettings.valueFormatting.valueItalic.value;
        
        const thresholdLabelColor = this.formattingSettings.colorZones.thresholdLabelColor.value.value;
        const thresholdBold = this.formattingSettings.colorZones.thresholdBold.value;
        const thresholdItalic = this.formattingSettings.colorZones.thresholdItalic.value;
        
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
                .attr('font-size', `${this.formattingSettings.colorZones.thresholdFontSize.value}px`)
                .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                .attr('fill', this.getColor('#666'))
                .text(this.formatThresholdValue(data.minimum));
            
            // Max tick and label on left side
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
                .attr('font-size', `${this.formattingSettings.colorZones.thresholdFontSize.value}px`)
                .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                .attr('fill', this.getColor('#666'))
                .text(this.formatThresholdValue(data.maximum));
            
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
                .attr('font-size', `${this.formattingSettings.colorZones.thresholdFontSize.value}px`)
                .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                .attr('fill', thresholdLabelColor)
                .text(this.formatThresholdValue(data.minimum));
            
            // Max tick and label on left side
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
                .attr('font-size', `${this.formattingSettings.colorZones.thresholdFontSize.value}px`)
                .attr('font-family', this.formattingSettings.colorZones.thresholdFontFamily.value)
                .attr('font-weight', thresholdBold ? 'bold' : 'normal')
                .attr('font-style', thresholdItalic ? 'italic' : 'normal')
                .attr('fill', thresholdLabelColor)
                .text(this.formatThresholdValue(data.maximum));
            
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

    private renderComparison(data: GaugeData, width: number, height: number, 
                            isVertical: boolean, margin: any) {
        if (data.target === null) return;
        
        const delta = data.value - data.target;
        const format = d3.format('+,.0f');
        const percentFormat = d3.format('+.1%');
        const deltaPercent = delta / data.target;
        
        const color = delta >= 0 ? '#10d61a' : '#d6101a';  // Green if positive, red if negative
        
        const comparisonGroup = this.container.append('g').classed('comparison', true);
        
        if (isVertical) {
            comparisonGroup.append('text')
                .attr('x', width + 10)
                .attr('y', Math.max(16, height / 2))
                .attr('text-anchor', 'start')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', color)
                .text(`${format(delta)} (${percentFormat(deltaPercent)})`);
        } else {
            comparisonGroup.append('text')
                .attr('x', width + 10)
                .attr('y', height + 25)
                .attr('text-anchor', 'start')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', color)
                .text(`${format(delta)} (${percentFormat(deltaPercent)})`);
        }
    }

    private renderCategoryLabel(category: string, width: number, height: number, isVertical: boolean) {
        const categoryGroup = this.container.append('g').classed('category-label', true);
        
        // Get category layout settings
        const fontSize = this.formattingSettings.categoryLayout.categoryFontSize.value;
        const position = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
        const categoryPadding = this.formattingSettings.categoryLayout.categoryPadding.value;
        const textColor = this.formattingSettings.categoryLayout.categoryTextColor.value.value;
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
        const formatType = this.formattingSettings.valueFormatting.valueFormat.value.value as string;
        const decimalPlaces = this.formattingSettings.valueFormatting.valueDecimalPlaces.value;
        const prefix = this.formattingSettings.valueFormatting.valuePrefix?.value ?? "";
        const suffix = this.formattingSettings.valueFormatting.valueSuffix?.value ?? "";
        
        let formattedValue: string;
        
        if (formatType === 'percentage') {
            // For percentage, divide by 100 and format with decimal places
            const percentValue = value / 100;
            const formatString = `.${decimalPlaces}%`;
            formattedValue = d3.format(formatString)(percentValue);
        } else {
            // For decimal, use thousands separator and decimal places
            const formatString = decimalPlaces > 0 ? `,.${decimalPlaces}f` : ',.0f';
            formattedValue = d3.format(formatString)(value);
        }
        
        return prefix + formattedValue + suffix;
    }

    private formatThresholdValue(value: number): string {
        // Threshold values use their own decimal places setting, no prefix/suffix
        const decimalPlaces = this.formattingSettings?.colorZones?.thresholdDecimalPlaces?.value;
        const places = (decimalPlaces !== undefined && decimalPlaces !== null) ? decimalPlaces : 0;
        const formatString = `,.${places}f`;
        return d3.format(formatString)(value);
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
    
    public destroy(): void {
        // Cleanup
    }
}
