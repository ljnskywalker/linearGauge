import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private host;
    private rootElement;
    private scrollContainer;
    private svg;
    private container;
    private formattingSettings;
    private formattingSettingsService;
    private tooltipServiceWrapper;
    private selectionManager;
    private allowInteractions;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private extractData;
    private renderMultipleGauges;
    private render;
    private renderColorZones;
    private renderFillBar;
    private renderBorder;
    private renderTargetMarker;
    private renderLabels;
    private renderComparison;
    private renderCategoryLabel;
    private getCategoryLines;
    private clear;
    private getTooltipData;
    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property.
     */
    getFormattingModel(): powerbi.visuals.FormattingModel;
    destroy(): void;
}
