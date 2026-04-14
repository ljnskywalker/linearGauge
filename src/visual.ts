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
    
    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.host = options.host;
        this.rootElement = options.element as HTMLElement;
        this.formattingSettingsService = new FormattingSettingsService();
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
            .classed('linearGauge', true);
        
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
            
            // Update color zones slices based on threshold mode
            this.formattingSettings.colorZones.populateSlices();

            console.log('Visual update', options);
            
            // Extract data from dataViews
            const dataView = options.dataViews?.[0];
            if (!dataView) {
                this.clear();
                return;
            }

            const gaugeDataArray = this.extractData(dataView);
            if (gaugeDataArray === null || gaugeDataArray.length === 0) {
                this.clear();
                return;
            }

            // Get viewport dimensions
            const width = options.viewport.width;
            const height = options.viewport.height;
            
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
        if (settings.gaugeSettings.showLabels.value) {
            const formatType = settings.gaugeSettings.valueFormat.value.value as string;
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
            const formatType = this.formattingSettings.gaugeSettings.valueFormat.value.value as string;
            const format = formatType === 'percentage' ? d3.format('.0%') : d3.format(',.0f');
            const getDisplayValue = (value: number) => formatType === 'percentage' ? value / 100 : value;
            const categoryPosition = this.formattingSettings.categoryLayout.categoryPosition.value.value as string;
            const thresholdOnRight = isVertical && categoryPosition === 'left';
            
            // Show all 4 threshold boundaries
            const thresholds = [
                { value: threshold1, label: format(getDisplayValue(threshold1)) },
                { value: threshold2, label: format(getDisplayValue(threshold2)) },
                { value: threshold3, label: format(getDisplayValue(threshold3)) },
                { value: threshold4, label: format(getDisplayValue(threshold4)) }
            ];
            
            const thresholdLabelsGroup = this.container.append('g').classed('threshold-labels', true);
            
            thresholds.forEach(threshold => {
                const pos = scale(threshold.value);
                
                if (isVertical) {
                    thresholdLabelsGroup.append('line')
                        .attr('x1', thresholdOnRight ? width : 0)
                        .attr('x2', thresholdOnRight ? width + 6 : -6)
                        .attr('y1', height - pos)
                        .attr('y2', height - pos)
                        .attr('stroke', '#777')
                        .attr('stroke-width', 1);

                    // Vertical: labels on opposite side when left category labels are used
                    thresholdLabelsGroup.append('text')
                        .attr('x', thresholdOnRight ? width + 8 : -8)
                        .attr('y', height - pos + 4)
                        .attr('text-anchor', thresholdOnRight ? 'start' : 'end')
                        .attr('font-size', '10px')
                        .attr('fill', '#999')
                        .attr('opacity', 0.8)
                        .text(threshold.label);
                } else {
                    thresholdLabelsGroup.append('line')
                        .attr('x1', pos)
                        .attr('x2', pos)
                        .attr('y1', 0)
                        .attr('y2', -6)
                        .attr('stroke', '#777')
                        .attr('stroke-width', 1);

                    // Horizontal: labels above at threshold positions
                    thresholdLabelsGroup.append('text')
                        .attr('x', pos)
                        .attr('y', -8)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '10px')
                        .attr('fill', '#999')
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
        } else if (data.color) {
            // Use Power BI color palette if not using static override
            fillColor = data.color;
        }
        
        const fillBar = this.container.append('rect')
            .classed('fill-bar', true);
        
        // Add tooltip to fill bar
        const tooltipData = this.getTooltipData(data);
        if (tooltipData.length > 0) {
            this.tooltipServiceWrapper.addTooltip(
                fillBar,
                (tooltipEvent: TooltipEventArgs<any>) => tooltipData
            );
        }
        
        if (isVertical) {
            const barWidth = width * fillThicknessFactor;
            const barX = (width - barWidth) / 2;

            // For vertical: fill from bottom to top
            fillBar
                .attr('x', barX)
                .attr('y', height)
                .attr('width', barWidth)
                .attr('height', 0)
                .attr('rx', 0)
                .attr('ry', 0)
                .attr('fill', fillColor)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.75);
            
            // Animate the fill bar upward
            fillBar.transition()
                .duration(animationDuration)
                .ease(d3.easeQuadInOut)
                .attr('y', height - fillSize)
                .attr('height', fillSize);
        } else {
            const barHeight = height * fillThicknessFactor;
            const barY = (height - barHeight) / 2;

            // For horizontal: fill from left to right
            fillBar
                .attr('x', 0)
                .attr('y', barY)
                .attr('width', 0)
                .attr('height', barHeight)
                .attr('rx', 0)
                .attr('ry', 0)
                .attr('fill', fillColor)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.75);
            
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
            .attr('stroke', '#666')
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
        const formatType = this.formattingSettings.gaugeSettings.valueFormat.value.value as string;
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
        const valueLabelPosition = this.formattingSettings.gaugeSettings.valueLabelPosition.value.value as string;
        
        // Format numbers based on selected format type
        const format = formatType === 'percentage' ? d3.format('.0%') : d3.format(',.0f');
        
        // Calculate display values for percentage format
        const getDisplayValue = (value: number) => {
            if (formatType === 'percentage') {
                // For percentage, divide by 100 because d3.format('%') multiplies by 100
                return value / 100;
            }
            return value;
        };

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
                .attr('stroke', '#666')
                .attr('stroke-width', 1);

            labelsGroup.append('text')
                .attr('x', -8)
                .attr('y', height + 4)
                .attr('text-anchor', 'end')
                .attr('font-size', '12px')
                .attr('fill', '#666')
                .text(format(getDisplayValue(data.minimum)));
            
            // Max tick and label on left side
            labelsGroup.append('line')
                .attr('x1', 0)
                .attr('x2', -6)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', '#666')
                .attr('stroke-width', 1);

            labelsGroup.append('text')
                .attr('x', -8)
                .attr('y', 4)
                .attr('text-anchor', 'end')
                .attr('font-size', '12px')
                .attr('fill', '#666')
                .text(format(getDisplayValue(data.maximum)));
            
            // Current value label (side)
            const valueY = height - scale(data.value);
            if (valueLabelPosition === 'left') {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -8)
                    .attr('y1', valueY)
                    .attr('y2', valueY)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -12)
                    .attr('y', valueY + 5)
                    .attr('text-anchor', 'end')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
            } else if (valueLabelPosition === 'top-center') {
                const valueTopY = valueY;
                labelsGroup.append('line')
                    .attr('x1', width / 2)
                    .attr('x2', width / 2)
                    .attr('y1', valueTopY)
                    .attr('y2', valueTopY - 6)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width / 2)
                    .attr('y', valueTopY - 10)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
            } else {
                labelsGroup.append('line')
                    .attr('x1', width)
                    .attr('x2', width + 8)
                    .attr('y1', valueY)
                    .attr('y2', valueY)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width + 15)
                    .attr('y', valueY + 5)
                    .attr('text-anchor', 'start')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
            }
        } else {
            // Min tick and label on left side
            labelsGroup.append('line')
                .attr('x1', 0)
                .attr('x2', -6)
                .attr('y1', height)
                .attr('y2', height)
                .attr('stroke', '#666')
                .attr('stroke-width', 1);

            labelsGroup.append('text')
                .attr('x', -8)
                .attr('y', height + 4)
                .attr('text-anchor', 'end')
                .attr('font-size', '12px')
                .attr('fill', '#666')
                .text(format(getDisplayValue(data.minimum)));
            
            // Max tick and label on left side
            labelsGroup.append('line')
                .attr('x1', 0)
                .attr('x2', -6)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', '#666')
                .attr('stroke-width', 1);

            labelsGroup.append('text')
                .attr('x', -8)
                .attr('y', 4)
                .attr('text-anchor', 'end')
                .attr('font-size', '12px')
                .attr('fill', '#666')
                .text(format(getDisplayValue(data.maximum)));
            
            // Current value label with configurable placement
            const valueX = scale(data.value);

            if (valueLabelPosition === 'left') {
                labelsGroup.append('line')
                    .attr('x1', 0)
                    .attr('x2', -8)
                    .attr('y1', height / 2)
                    .attr('y2', height / 2)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', -12)
                    .attr('y', height / 2 + 5)
                    .attr('text-anchor', 'end')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
            } else if (valueLabelPosition === 'right') {
                labelsGroup.append('line')
                    .attr('x1', width)
                    .attr('x2', width + 8)
                    .attr('y1', height / 2)
                    .attr('y2', height / 2)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', width + 12)
                    .attr('y', height / 2 + 5)
                    .attr('text-anchor', 'start')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
            } else {
                const barHeight = height * fillThicknessFactor;
                const barTopY = (height - barHeight) / 2;

                labelsGroup.append('line')
                    .attr('x1', valueX)
                    .attr('x2', valueX)
                    .attr('y1', barTopY)
                    .attr('y2', barTopY - 6)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1);

                labelsGroup.append('text')
                    .attr('x', valueX)
                    .attr('y', barTopY - 10)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000')
                    .text(format(getDisplayValue(data.value)));
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