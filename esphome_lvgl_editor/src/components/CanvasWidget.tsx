import React, { useRef, useEffect, useState } from 'react';
import { Widget } from '../types/widgets';
import { useEditorStore } from '../store/editorStore';
import { parseHexColor, colorToRgb, parseOpacity } from '../utils/colorUtils';
import { getFontRegistry } from '../utils/fontRegistry';
import { measurePreviewText, resolvePreviewFont } from '../utils/textMetrics';

interface CanvasWidgetProps {
  widget: Widget;
  isSelected: boolean;
  isTopLayer?: boolean;
  widgetPath?: string;
  parentBounds?: {
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
  };
}

export const CanvasWidget: React.FC<CanvasWidgetProps> = ({ widget, isSelected, isTopLayer = false, widgetPath, parentBounds }) => {
  const { updateWidget, updateNestedWidget, selectWidget, selectWidgetByPath, selectedWidgetPath, displaySize, previewScale, previewMode, updateTopLayerWidget, snapToGrid, snapSize, config, editMode, currentPageId, setCurrentPage } = useEditorStore();
  const scaleFactor = previewScale / 100;
  const boundsWidth = parentBounds?.width ?? displaySize.width;
  const boundsHeight = parentBounds?.height ?? displaySize.height;
  const boundsOffsetX = parentBounds?.offsetX ?? 0;
  const boundsOffsetY = parentBounds?.offsetY ?? 0;

  // Execute an lvgl action object from on_press/on_click
  const executePageAction = (then: any) => {
    if (!then) return;
    const actions = Array.isArray(then) ? then : [then];
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;
      if ('lvgl.page.show' in action) {
        const target = action['lvgl.page.show'];
        if (target && config.pages.find(p => p.id === target)) setCurrentPage(target);
      } else if ('lvgl.page.next' in action) {
        const pages = config.pages;
        const idx = pages.findIndex(p => p.id === currentPageId);
        if (idx < pages.length - 1) setCurrentPage(pages[idx + 1].id);
      } else if ('lvgl.page.previous' in action) {
        const pages = config.pages;
        const idx = pages.findIndex(p => p.id === currentPageId);
        if (idx > 0) setCurrentPage(pages[idx - 1].id);
      }
    }
  };
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Only allow interaction if we're in the correct edit mode
  const isInteractive = isTopLayer ? editMode === 'top_layer' : editMode === 'pages';
  const isHiddenInPreview = Boolean(widget.hidden && previewMode);
  const showHiddenGhost = Boolean(widget.hidden && !previewMode);

  if (isHiddenInPreview) {
    return null;
  }

  // Get applied styles from style_definitions
  const getAppliedStyles = () => {
    if (!widget.styles || !config.style_definitions) return {};
    
    const styleNames = widget.styles.split(' ');
    let appliedStyles: any = {};
    
    styleNames.forEach(styleName => {
      const styleDef = config.style_definitions?.find(s => s.id === styleName);
      if (styleDef) {
        Object.assign(appliedStyles, styleDef);
      }
    });
    
    return appliedStyles;
  };

  const getMergedStylesForWidget = (targetWidget: Widget) => {
    if (!targetWidget.styles || !config.style_definitions) return {} as any;

    const styleNames = targetWidget.styles.split(' ');
    const mergedStyles: any = {};

    styleNames.forEach(styleName => {
      const styleDef = config.style_definitions?.find(s => s.id === styleName);
      if (styleDef) Object.assign(mergedStyles, styleDef);
    });

    return mergedStyles;
  };

  const appliedStyles = getAppliedStyles();

  // Font registry (rebuilt only when config.fonts changes)
  const fontRegistry = getFontRegistry(config.fonts);

  /** Resolve a font-id to CSS-ready { fontSize, fontFamily } */
  const resolveFont = (fontId: string | undefined): { fontSize: string; fontFamily: string } => {
    if (fontId) {
      const entry = fontRegistry.get(fontId);
      if (entry) return { fontSize: `${entry.size}px`, fontFamily: entry.fontFamily };
    }
    const fallback = resolvePreviewFont(fontId, config.fonts);
    return { fontSize: fallback.fontSize, fontFamily: fallback.fontFamily };
  };

  const getSidePadding = (side: 'top' | 'right' | 'bottom' | 'left') => {
    const specificKey = `pad_${side}`;
    return (widget as any)[specificKey] ?? appliedStyles[specificKey] ?? (widget as any).pad_all ?? appliedStyles.pad_all ?? 0;
  };

  const getPaddingStyle = () => ({
    paddingTop: `${getSidePadding('top')}px`,
    paddingRight: `${getSidePadding('right')}px`,
    paddingBottom: `${getSidePadding('bottom')}px`,
    paddingLeft: `${getSidePadding('left')}px`,
  });

  const measureTextBlock = (text: string, fontId: string | undefined, extraPadding = { x: 8, y: 4 }, forceUppercase = false) => measurePreviewText({
    text,
    fontId,
    fonts: config.fonts,
    textLetterSpace: (widget as any).text_letter_space ?? appliedStyles.text_letter_space,
    textLineSpace: (widget as any).text_line_space ?? appliedStyles.text_line_space,
    padAll: (widget as any).pad_all ?? appliedStyles.pad_all,
    padTop: (widget as any).pad_top ?? appliedStyles.pad_top,
    padRight: (widget as any).pad_right ?? appliedStyles.pad_right,
    padBottom: (widget as any).pad_bottom ?? appliedStyles.pad_bottom,
    padLeft: (widget as any).pad_left ?? appliedStyles.pad_left,
    extraHorizontalPadding: extraPadding.x,
    extraVerticalPadding: extraPadding.y,
    forceUppercase,
  });

  const toPx = (value: string | undefined) => {
    const parsed = Number.parseFloat(value || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getWidgetSidePadding = (targetWidget: Widget, targetStyles: any, side: 'top' | 'right' | 'bottom' | 'left') => {
    const specificKey = `pad_${side}`;
    return (targetWidget as any)[specificKey] ?? targetStyles[specificKey] ?? (targetWidget as any).pad_all ?? targetStyles.pad_all ?? 0;
  };

  const measureTextBlockForWidget = (targetWidget: Widget, text: string, fontId: string | undefined, extraPadding = { x: 8, y: 4 }, forceUppercase = false) => {
    const targetStyles = getMergedStylesForWidget(targetWidget);
    return measurePreviewText({
      text,
      fontId,
      fonts: config.fonts,
      textLetterSpace: (targetWidget as any).text_letter_space ?? targetStyles.text_letter_space,
      textLineSpace: (targetWidget as any).text_line_space ?? targetStyles.text_line_space,
      padAll: (targetWidget as any).pad_all ?? targetStyles.pad_all,
      padTop: (targetWidget as any).pad_top ?? targetStyles.pad_top,
      padRight: (targetWidget as any).pad_right ?? targetStyles.pad_right,
      padBottom: (targetWidget as any).pad_bottom ?? targetStyles.pad_bottom,
      padLeft: (targetWidget as any).pad_left ?? targetStyles.pad_left,
      extraHorizontalPadding: extraPadding.x,
      extraVerticalPadding: extraPadding.y,
      forceUppercase,
    });
  };

  const estimateWidgetSize = (targetWidget: Widget): { width: number; height: number } => {
    const targetStyles = getMergedStylesForWidget(targetWidget);

    const measuredWidth = (targetWidget as any)._measuredWidth;
    const measuredHeight = (targetWidget as any)._measuredHeight;
    const explicitWidth = typeof targetWidget.width === 'number' ? targetWidget.width : undefined;
    const explicitHeight = typeof targetWidget.height === 'number' ? targetWidget.height : undefined;

    if (explicitWidth && explicitHeight) {
      return { width: explicitWidth, height: explicitHeight };
    }

    switch (targetWidget.type) {
      case 'label': {
        const metrics = measureTextBlockForWidget(targetWidget, targetWidget.text || '', targetStyles.text_font || targetWidget.text_font, { x: 8, y: 2 });
        return {
          width: explicitWidth ?? measuredWidth ?? metrics.width,
          height: explicitHeight ?? measuredHeight ?? metrics.height,
        };
      }
      case 'button': {
        const buttonText = targetWidget.widgets?.[0] && 'text' in targetWidget.widgets[0] ? (targetWidget.widgets[0].text || 'BUTTON') : 'BUTTON';
        const metrics = measureTextBlockForWidget(targetWidget, buttonText, targetStyles.text_font || targetWidget.text_font, { x: 36, y: 16 }, true);
        return {
          width: explicitWidth ?? measuredWidth ?? metrics.width,
          height: explicitHeight ?? measuredHeight ?? Math.max(metrics.height, 36),
        };
      }
      case 'meter':
        return { width: explicitWidth ?? 180, height: explicitHeight ?? 180 };
      case 'buttonmatrix': {
        const rows = ((targetWidget as any).rows || []) as Array<{ buttons?: Array<{ text?: string }> }>;
        const widestRow = rows.reduce((max, row) => Math.max(max, row.buttons?.length || 0), 1);
        const rowCount = Math.max(rows.length, 1);
        return {
          width: explicitWidth ?? Math.max(120, widestRow * 68),
          height: explicitHeight ?? Math.max(32, rowCount * 28 + (rowCount - 1) * 2),
        };
      }
      case 'line': {
        const points = targetWidget.points || [[0, 0], [100, 0]];
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        return {
          width: explicitWidth ?? Math.max(...xs) - Math.min(...xs),
          height: explicitHeight ?? Math.max(...ys) - Math.min(...ys),
        };
      }
      case 'slider':
        return { width: explicitWidth ?? 200, height: explicitHeight ?? 20 };
      case 'switch':
        return { width: explicitWidth ?? 52, height: explicitHeight ?? 28 };
      case 'checkbox':
        return {
          width: explicitWidth ?? Math.max(24, targetWidget.text ? measureTextBlockForWidget(targetWidget, targetWidget.text, targetStyles.text_font || targetWidget.text_font, { x: 32, y: 4 }).width : 24),
          height: explicitHeight ?? 24,
        };
      case 'bar':
        return { width: explicitWidth ?? 180, height: explicitHeight ?? 22 };
      case 'led':
        return { width: explicitWidth ?? 24, height: explicitHeight ?? 24 };
      case 'arc':
        return { width: explicitWidth ?? 100, height: explicitHeight ?? 100 };
      case 'spinner':
        return { width: explicitWidth ?? 42, height: explicitHeight ?? 42 };
      case 'image':
        return { width: explicitWidth ?? 96, height: explicitHeight ?? 96 };
      case 'textarea':
        return { width: explicitWidth ?? 200, height: explicitHeight ?? 100 };
      case 'spinbox':
        return { width: explicitWidth ?? 110, height: explicitHeight ?? 36 };
      case 'msgbox':
        return { width: explicitWidth ?? 180, height: explicitHeight ?? 120 };
      case 'dropdown':
        return { width: explicitWidth ?? 150, height: explicitHeight ?? 38 };
      case 'roller':
        return { width: explicitWidth ?? 100, height: explicitHeight ?? 120 };
      case 'obj': {
        const children = targetWidget.widgets || [];
        const padLeft = getWidgetSidePadding(targetWidget, targetStyles, 'left');
        const padRight = getWidgetSidePadding(targetWidget, targetStyles, 'right');
        const padTop = getWidgetSidePadding(targetWidget, targetStyles, 'top');
        const padBottom = getWidgetSidePadding(targetWidget, targetStyles, 'bottom');

        const childBounds = children.reduce((acc, child) => {
          const childSize = estimateWidgetSize(child);
          const childAlign = child.align?.toUpperCase() || '';
          const x = child.x || 0;
          const y = child.y || 0;

          let extentWidth = x + childSize.width;
          let extentHeight = y + childSize.height;

          if (childAlign.includes('CENTER') || childAlign.includes('_MID')) {
            extentWidth = Math.max(extentWidth, childSize.width + Math.abs(x) * 2);
          }
          if (childAlign === 'CENTER' || (childAlign.includes('MID') && !childAlign.includes('TOP') && !childAlign.includes('BOTTOM')) || childAlign.includes('_LEFT') || childAlign.includes('_RIGHT')) {
            extentHeight = Math.max(extentHeight, childSize.height + Math.abs(y) * 2);
          }
          if (childAlign.includes('RIGHT')) {
            extentWidth = Math.max(extentWidth, childSize.width + Math.abs(x));
          }
          if (childAlign.includes('BOTTOM')) {
            extentHeight = Math.max(extentHeight, childSize.height + Math.abs(y));
          }

          return {
            width: Math.max(acc.width, extentWidth),
            height: Math.max(acc.height, extentHeight),
          };
        }, { width: 0, height: 0 });

        return {
          width: explicitWidth ?? Math.max(40, childBounds.width + padLeft + padRight),
          height: explicitHeight ?? Math.max(20, childBounds.height + padTop + padBottom),
        };
      }
      default:
        return { width: explicitWidth ?? 100, height: explicitHeight ?? 50 };
    }
  };

  const renderMeterPreview = () => {
    const meter = widget as any;
    const scales = Array.isArray(meter.scales) ? meter.scales : [];
    const labelColor = parseHexColor(meter.text_color || '#222222');

    const polar = (angleDeg: number, radius: number) => {
      const angle = ((angleDeg - 90) * Math.PI) / 180;
      return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      };
    };

    const getAngle = (scale: any, value: number) => {
      const from = Number(scale?.range_from ?? 0);
      const to = Number(scale?.range_to ?? 100);
      const rotation = Number(scale?.rotation ?? 270);
      const range = Number(scale?.angle_range ?? 360);
      if (to === from) return rotation;
      return rotation + ((value - from) / (to - from)) * range;
    };

    const getValueAtTick = (scale: any, tickIndex: number, tickCount: number) => {
      const from = Number(scale?.range_from ?? 0);
      const to = Number(scale?.range_to ?? tickCount - 1);
      if (tickCount <= 1) return from;
      return from + ((to - from) * tickIndex) / (tickCount - 1);
    };

    const renderScale = (scale: any, scaleIndex: number) => {
      const ticks = scale?.ticks;
      const tickCount = Number(ticks?.count ?? 0);
      const majorStride = Math.max(1, Number(ticks?.major?.stride ?? 1));
      const minorLength = Number(ticks?.length ?? 5);
      const majorLength = Number(ticks?.major?.length ?? Math.max(minorLength + 4, 9));
      const minorWidth = Number(ticks?.width ?? 1);
      const majorWidth = Number(ticks?.major?.width ?? Math.max(minorWidth, 2));
      const minorColor = parseHexColor(ticks?.color || '#9da3aa');
      const majorColor = parseHexColor(ticks?.major?.color || minorColor);
      const labelGap = Number(ticks?.major?.label_gap ?? 12);
      const parts: React.ReactNode[] = [];

      if (tickCount > 0) {
        for (let index = 0; index < tickCount; index += 1) {
          const isMajor = Boolean(ticks?.major) && index % majorStride === 0;
          const angle = getAngle(scale, getValueAtTick(scale, index, tickCount));
          const outer = polar(angle, 44);
          const inner = polar(angle, 44 - (isMajor ? majorLength : minorLength));
          parts.push(
            <line
              key={`tick-${scaleIndex}-${index}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isMajor ? majorColor : minorColor}
              strokeWidth={isMajor ? majorWidth : minorWidth}
              strokeLinecap="round"
            />
          );

          if (isMajor && ticks?.major?.label_gap !== undefined) {
            const labelPoint = polar(angle, 44 - majorLength - labelGap);
            const labelValue = getValueAtTick(scale, index, tickCount);
            const labelText = Number.isInteger(labelValue) ? `${labelValue}` : labelValue.toFixed(1);
            parts.push(
              <text
                key={`label-${scaleIndex}-${index}`}
                x={labelPoint.x}
                y={labelPoint.y}
                fill={labelColor}
                fontSize="8"
                fontWeight="500"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {labelText}
              </text>
            );
          }
        }
      }

      (scale?.indicators || []).forEach((indicator: any, indicatorIndex: number) => {
        if (indicator?.line) {
          const line = indicator.line;
          const angle = getAngle(scale, Number(line.value ?? 0));
          const end = polar(angle, Math.max(10, 41 + Number(line.r_mod ?? -6)));
          parts.push(
            <line
              key={`line-indicator-${scaleIndex}-${indicatorIndex}`}
              x1={50}
              y1={50}
              x2={end.x}
              y2={end.y}
              stroke={parseHexColor(line.color || '#d64541')}
              strokeWidth={Number(line.width) || 2}
              strokeLinecap="round"
            />
          );
        }

        if (indicator?.arc) {
          const arc = indicator.arc;
          const startAngle = getAngle(scale, Number(arc.start_value ?? scale?.range_from ?? 0));
          const endAngle = getAngle(scale, Number(arc.end_value ?? arc.value ?? scale?.range_to ?? 100));
          const radius = Math.max(18, 37 + Number(arc.r_mod ?? 0));
          const start = polar(startAngle, radius);
          const end = polar(endAngle, radius);
          const delta = ((endAngle - startAngle) % 360 + 360) % 360;
          const largeArc = delta > 180 ? 1 : 0;
          parts.push(
            <path
              key={`arc-indicator-${scaleIndex}-${indicatorIndex}`}
              d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
              stroke={parseHexColor(arc.color || '#2f95e9')}
              strokeWidth={Number(arc.width) || 4}
              fill="none"
              strokeLinecap="round"
            />
          );
        }
      });

      return parts;
    };

    return (
      <div ref={contentRef} style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        overflow: 'visible',
        boxSizing: 'border-box'
      }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#d8d8d8" strokeWidth="1" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#efefef" strokeWidth="0.8" />
          {scales.map((scale: any, scaleIndex: number) => (
            <g key={`scale-${scaleIndex}`}>{renderScale(scale, scaleIndex)}</g>
          ))}
          <circle cx="50" cy="50" r="3.5" fill="#2d2d2d" />
        </svg>
      </div>
    );
  };

  const getAutoWidgetSize = () => {
    const styleApplied = new Set<string>((widget as any)._styleApplied || []);
    const hasExplicitWidth = Boolean((widget as any)._explicitWidth || (typeof widget.width === 'string' && !styleApplied.has('width')));
    const hasExplicitHeight = Boolean((widget as any)._explicitHeight || (typeof widget.height === 'string' && !styleApplied.has('height')));
    const measuredWidth = (widget as any)._measuredWidth;
    const measuredHeight = (widget as any)._measuredHeight;

    if (widget.type === 'label') {
      const measured = measureTextBlock(widget.text || '', appliedStyles.text_font || widget.text_font, { x: 8, y: 2 });
      return {
        width: hasExplicitWidth ? widget.width : (measuredWidth ?? measured.width),
        height: hasExplicitHeight ? widget.height : (measuredHeight ?? measured.height),
      };
    }

    if (widget.type === 'button') {
      const buttonText: string = widget.widgets?.[0] && 'text' in widget.widgets[0] ? (widget.widgets[0].text || 'BUTTON') : 'BUTTON';
      const measured = measureTextBlock(buttonText, appliedStyles.text_font || widget.text_font, { x: 36, y: 16 }, true);
      return {
        width: hasExplicitWidth ? widget.width : (measuredWidth ?? measured.width),
        height: hasExplicitHeight ? widget.height : Math.max(measuredHeight ?? measured.height, 36),
      };
    }

    if (widget.type === 'obj') {
      const children = widget.widgets || [];
      const padLeft = getSidePadding('left');
      const padRight = getSidePadding('right');
      const padTop = getSidePadding('top');
      const padBottom = getSidePadding('bottom');

      const childBounds = children.reduce((acc, child) => {
        const childSize = estimateWidgetSize(child);
        const childWidth = childSize.width;
        const childHeight = childSize.height;
        const childAlign = child.align?.toUpperCase() || '';
        const x = child.x || 0;
        const y = child.y || 0;

        let extentWidth = x + childWidth;
        let extentHeight = y + childHeight;

        if (childAlign.includes('CENTER') || childAlign.includes('_MID')) {
          extentWidth = Math.max(extentWidth, childWidth + Math.abs(x) * 2);
        }
        if (childAlign === 'CENTER' || (childAlign.includes('MID') && !childAlign.includes('TOP') && !childAlign.includes('BOTTOM')) || childAlign.includes('_LEFT') || childAlign.includes('_RIGHT')) {
          extentHeight = Math.max(extentHeight, childHeight + Math.abs(y) * 2);
        }
        if (childAlign.includes('RIGHT')) {
          extentWidth = Math.max(extentWidth, childWidth + Math.abs(x));
        }
        if (childAlign.includes('BOTTOM')) {
          extentHeight = Math.max(extentHeight, childHeight + Math.abs(y));
        }

        return {
          width: Math.max(acc.width, extentWidth),
          height: Math.max(acc.height, extentHeight),
        };
      }, { width: 0, height: 0 });

      const autoWidth = childBounds.width > 0 ? childBounds.width + padLeft + padRight : undefined;
      const autoHeight = childBounds.height > 0 ? childBounds.height + padTop + padBottom : undefined;

      return {
        width: hasExplicitWidth && widget.width !== 'SIZE_CONTENT' ? widget.width : (autoWidth ?? widget.width),
        height: hasExplicitHeight && widget.height !== 'SIZE_CONTENT' ? widget.height : (autoHeight ?? widget.height),
      };
    }

    return {
      width: widget.width,
      height: widget.height,
    };
  };

  const updateCurrentWidget = (updates: Partial<Widget>) => {
    if (widgetPath && !isTopLayer) {
      updateNestedWidget(widgetPath, updates);
      return;
    }

    const updateFn = isTopLayer ? updateTopLayerWidget : updateWidget;
    updateFn(widget.id || '', updates);
  };

  const snapValue = (value: number, isPosition: boolean = false, currentSize: number = 0) => {
    if (!snapToGrid) return value;
    
    // Snap to edges with higher priority (within 10px threshold)
    const edgeThreshold = 10;
    
    if (isPosition) {
      // Snap to left edge (0)
      if (Math.abs(value) < edgeThreshold) return 0;
      
      // Snap to right/bottom edge (displaySize - widget size)
      const maxPosition = (isPosition ? boundsWidth : boundsHeight) - currentSize;
      if (Math.abs(value - maxPosition) < edgeThreshold) return maxPosition;
    }
    
    // Regular grid snapping
    return Math.round(value / snapSize) * snapSize;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    // Line widgets can't be dragged - they're positioned by their points
    if (widget.type === 'line') {
      e.stopPropagation();
      if (widgetPath && !isTopLayer) selectWidgetByPath(widgetPath);
      else selectWidget(widget.id || '');
      return;
    }
    e.stopPropagation();
    if (widgetPath && !isTopLayer) selectWidgetByPath(widgetPath);
    else selectWidget(widget.id || '');
    setIsDragging(true);
    const autoSize = getAutoWidgetSize();
    const width = typeof autoSize.width === 'number' ? autoSize.width : 100;
    const height = typeof autoSize.height === 'number' ? autoSize.height : 50;
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      width,
      height
    });
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (!isInteractive) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    const autoSize = getAutoWidgetSize();
    const width = typeof autoSize.width === 'number' ? autoSize.width : 100;
    const height = typeof autoSize.height === 'number' ? autoSize.height : 50;
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      width,
      height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isResizing) {
        const canvas = document.getElementById('canvas');
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          
          // Calculate new position based on mouse movement
          const deltaX = (e.clientX - dragStart.x) / scaleFactor;
          const deltaY = (e.clientY - dragStart.y) / scaleFactor;
          const canvasWidth = parentBounds?.width ?? (canvasRect.width / scaleFactor);
          const canvasHeight = parentBounds?.height ?? (canvasRect.height / scaleFactor);
          
          // Get current alignment
          const align = widget.align?.toUpperCase() || '';
          const autoSize = getAutoWidgetSize();
          const widgetWidth = typeof autoSize.width === 'number' ? autoSize.width : 50;
          const widgetHeight = typeof autoSize.height === 'number' ? autoSize.height : 50;
          
          // Calculate new position based on alignment
          let newX = widget.x + deltaX;
          let newY = widget.y + deltaY;
          
          // For RIGHT alignment, x is offset from right edge (typically negative)
          if (align.includes('RIGHT')) {
            // When dragging right-aligned widgets, maintain offset from right edge
            const currentLeft = canvasWidth - widgetWidth + (widget.x || 0);
            const newLeft = currentLeft + deltaX;
            newX = newLeft - (canvasWidth - widgetWidth);
          }
          // For CENTER/_MID horizontal alignment, x is offset from center
          else if (align.includes('CENTER') || align.includes('_MID')) {
            const currentLeft = (canvasWidth - widgetWidth) / 2 + (widget.x || 0);
            const newLeft = currentLeft + deltaX;
            newX = newLeft - (canvasWidth - widgetWidth) / 2;
          }
          
          // For BOTTOM alignment, y is offset from bottom edge
          if (align.includes('BOTTOM')) {
            const currentTop = canvasHeight - widgetHeight + (widget.y || 0);
            const newTop = currentTop + deltaY;
            newY = newTop - (canvasHeight - widgetHeight);
          }
          // For vertical MID/CENTER alignment
          else if ((align === 'CENTER' || align.includes('MID') || align.includes('_LEFT') || align.includes('_RIGHT')) && !align.includes('OUT_')) {
            const currentTop = (canvasHeight - widgetHeight) / 2 + (widget.y || 0);
            const newTop = currentTop + deltaY;
            newY = newTop - (canvasHeight - widgetHeight) / 2;
          }
          
          updateCurrentWidget({
            x: snapValue(newX, true, widgetWidth),
            y: snapValue(newY, true, widgetHeight)
          });
          
          // Update drag start for next movement
          setDragStart({ x: e.clientX, y: e.clientY, width: dragStart.width, height: dragStart.height });
        }
      } else if (isResizing) {
        const deltaX = (e.clientX - dragStart.x) / scaleFactor;
        const deltaY = (e.clientY - dragStart.y) / scaleFactor;
        
        let newWidth = dragStart.width;
        let newHeight = dragStart.height;
        let newX = widget.x;
        let newY = widget.y;
        
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(20, dragStart.width + deltaX);
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.max(20, dragStart.width - deltaX);
          newX = widget.x + deltaX;
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(20, dragStart.height + deltaY);
        }
        if (resizeDirection.includes('n')) {
          newHeight = Math.max(20, dragStart.height - deltaY);
          newY = widget.y + deltaY;
        }
        
        updateCurrentWidget({
          width: snapValue(newWidth),
          height: snapValue(newHeight),
          x: snapValue(newX),
          y: snapValue(newY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection, dragStart, widget.id, widget.x, widget.y, widget.width, widget.height, scaleFactor, parentBounds, updateWidget, updateNestedWidget, updateTopLayerWidget]);

  const renderWidget = () => {
    // Merge widget properties with applied styles
    const effectiveBgColor = appliedStyles.bg_color || widget.bg_color;
    const effectiveTextColor = appliedStyles.text_color || ('text_color' in widget ? widget.text_color : null);
    const effectiveBorderColor = appliedStyles.border_color || widget.border_color;
    const effectiveBorderWidth = appliedStyles.border_width ?? widget.border_width;
    const effectiveRadius = appliedStyles.radius ?? widget.radius;
    const effectiveTextFont = appliedStyles.text_font || widget.text_font;
    const effectiveBgGradColor = appliedStyles.bg_grad_color;
    const effectiveBgGradDir = appliedStyles.bg_grad_dir;
    const effectiveBgOpa = appliedStyles.bg_opa ?? widget.opacity;
    const effectivePadAll = appliedStyles.pad_all ?? 0;
    const fontEntry = effectiveTextFont ? fontRegistry.get(effectiveTextFont) : undefined;
    const usesIconFont = Boolean(fontEntry?.hasIcons);

    // Parse colors
    const bgColorStr = effectiveBgColor 
      ? (typeof effectiveBgColor === 'object' ? colorToRgb(effectiveBgColor) : parseHexColor(effectiveBgColor))
      : 'transparent';
    
    const textColorStr = effectiveTextColor
      ? (typeof effectiveTextColor === 'object' ? colorToRgb(effectiveTextColor) : parseHexColor(effectiveTextColor))
      : '#ffffff';
    
    const borderColorStr = effectiveBorderColor
      ? (typeof effectiveBorderColor === 'object' ? colorToRgb(effectiveBorderColor) : parseHexColor(effectiveBorderColor))
      : '#555';

    // Handle gradient
    let backgroundStyle = bgColorStr;
    if (effectiveBgGradColor) {
      const gradColorStr = typeof effectiveBgGradColor === 'object' 
        ? colorToRgb(effectiveBgGradColor) 
        : parseHexColor(effectiveBgGradColor);
      
      const direction = effectiveBgGradDir === 'HOR' ? 'to right' : 
                       effectiveBgGradDir === 'VER' ? 'to bottom' : 'to bottom';
      backgroundStyle = `linear-gradient(${direction}, ${bgColorStr}, ${gradColorStr})`;
    }

    const commonStyle: React.CSSProperties = {
      backgroundColor: bgColorStr,
      background: backgroundStyle,
      borderRadius: effectiveRadius ? `${effectiveRadius}px` : '0px',
      border: effectiveBorderWidth 
        ? `${effectiveBorderWidth}px solid ${borderColorStr}`
        : 'none',
      opacity: effectiveBgOpa ? parseOpacity(effectiveBgOpa) : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: textColorStr,
      fontSize: resolveFont(effectiveTextFont).fontSize,
      fontFamily: resolveFont(effectiveTextFont).fontFamily,
      overflow: 'hidden',
      ...getPaddingStyle(),
      boxSizing: 'border-box'
    };

    switch (widget.type) {
      case 'label':
        const labelText = widget.text || '';
        const labelMetrics = measureTextBlock(labelText, effectiveTextFont, { x: 8, y: 2 });
        const { fontSize, fontFamily: labelFontFamily, fontSizePx, lineHeight, letterSpace } = labelMetrics;
        const fontWeight = usesIconFont ? '400' : (fontSizePx >= 20 ? '600' : '400');
        
        // Determine text justification based on align property
        const align = widget.align?.toUpperCase() || '';
        let horizontalAlign = 'flex-start';
        let verticalAlign = 'flex-start';
        let textAlign: 'left' | 'center' | 'right' = 'left';
        
        // Horizontal alignment
        if (align.includes('RIGHT')) {
          horizontalAlign = 'flex-end';
          textAlign = 'right';
        } else if (align.includes('CENTER') || align.includes('_MID')) {
          horizontalAlign = 'center';
          textAlign = 'center';
        } else if (align.includes('LEFT')) {
          horizontalAlign = 'flex-start';
          textAlign = 'left';
        }
        
        // Vertical alignment
        if (align.includes('BOTTOM')) {
          verticalAlign = 'flex-end';
        } else if (align === 'CENTER' || (align.includes('MID') && !align.includes('TOP') && !align.includes('BOTTOM'))) {
          verticalAlign = 'center';
        } else if (align.includes('TOP')) {
          verticalAlign = 'flex-start';
        }
        
        // Override with explicit text_align if set
        if (widget.text_align) {
          textAlign = widget.text_align === 'right' ? 'right' : 
                     widget.text_align === 'center' ? 'center' : 'left';
          horizontalAlign = widget.text_align === 'right' ? 'flex-end' : 
                           widget.text_align === 'center' ? 'center' : 'flex-start';
        }
        
        // Explicit size means LVGL constrains the label; no size = SIZE_CONTENT (text drives size)
        const styleApplied = new Set<string>((widget as any)._styleApplied || []);
        const hasExplicitW = Boolean((widget as any)._explicitWidth || (typeof widget.width === 'string' && widget.width !== 'SIZE_CONTENT' && !styleApplied.has('width')));
        const hasExplicitH = Boolean((widget as any)._explicitHeight || (typeof widget.height === 'string' && widget.height !== 'SIZE_CONTENT' && !styleApplied.has('height')));
        return (
          <div ref={contentRef} style={{
            backgroundColor: 'transparent',
            border: 'none',
            display: 'flex',
            justifyContent: horizontalAlign,
            alignItems: verticalAlign,
            ...getPaddingStyle(),
            color: textColorStr,
            fontWeight,
            fontSize,
            fontFamily: labelFontFamily,
            lineHeight: usesIconFont ? '1' : `${lineHeight}px`,
            letterSpacing: usesIconFont ? '0px' : `${letterSpace}px`,
            textAlign: textAlign,
            whiteSpace: hasExplicitW ? 'normal' : 'nowrap',
            wordBreak: hasExplicitW ? 'break-word' : 'normal',
            overflow: 'visible',
            width: hasExplicitW ? '100%' : `${labelMetrics.width}px`,
            height: hasExplicitH ? '100%' : `${labelMetrics.height}px`,
            boxSizing: 'border-box',
            textRendering: 'geometricPrecision',
            WebkitFontSmoothing: 'antialiased',
            textShadow: isTopLayer && !usesIconFont ? '0 1px 2px rgba(0,0,0,0.45)' : 'none'
          }}>
            {labelText}
          </div>
        );
      
      case 'button':
        const buttonText: string = widget.widgets?.[0] && 'text' in widget.widgets[0] ? (widget.widgets[0].text || 'BUTTON') : 'BUTTON';
        const buttonMetrics = measureTextBlock(buttonText, effectiveTextFont, { x: 28, y: 12 }, false);
        return (
          <div
            ref={contentRef}
            onClick={(e) => {
              e.stopPropagation();
              const then = (widget as any).on_click?.then ?? (widget as any).on_press?.then;
              if (then) executePageAction(then);
            }}
            style={{
              ...commonStyle,
              cursor: 'pointer',
              background: widget.bg_color
                ? colorToRgb(widget.bg_color)
                : '#2f95e9',
              border: '1px solid rgba(0,0,0,0.08)',
              fontWeight: '500',
              letterSpacing: `${Math.min(buttonMetrics.letterSpace, 0.3)}px`,
              fontSize: buttonMetrics.fontSize,
              fontFamily: buttonMetrics.fontFamily,
              boxShadow: '0 1px 2px rgba(0,0,0,0.16)',
              width: widget.width ? '100%' : 'auto',
              height: widget.height ? '100%' : 'auto',
              ...getPaddingStyle(),
              userSelect: 'none'
            }}
          >
            {buttonText}
          </div>
        );
      
      case 'slider':
        const sliderValue = ((widget.value || 50) / (widget.max_value || 100)) * 100;
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const newVal = Math.round(ratio * (widget.max_value || 100));
              updateCurrentWidget({ value: newVal } as any);
            }}
            style={{
              ...commonStyle,
              position: 'relative',
              padding: 0,
              background: '#cfe8f7',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: 2,
                bottom: 2,
                width: `${sliderValue}%`,
                background: '#2f95e9',
                borderRadius: 'inherit',
                minWidth: sliderValue > 0 ? 8 : 0
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${sliderValue}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '16px',
                background: '#2f95e9',
                borderRadius: '50%',
                border: '2px solid #2f95e9'
              }}
            />
          </div>
        );
      
      case 'switch':
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              updateCurrentWidget({ checked: !widget.checked } as any);
            }}
            style={{
              ...commonStyle,
              position: 'relative',
              background: widget.checked ? '#2f95e9' : '#d5dbe1',
              transition: 'background-color 0.2s ease',
              borderRadius: '999px',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '44%',
                height: '78%',
                background: '#ffffff',
                borderRadius: '50%',
                left: widget.checked ? '50%' : '5%',
                transition: 'left 0.3s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.18)'
              }}
            />
          </div>
        );
      
      case 'checkbox':
        const checkboxText = widget.text || '';
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              updateCurrentWidget({ checked: !widget.checked } as any);
            }}
            style={{
              ...commonStyle,
              background: 'transparent',
              border: 'none',
              justifyContent: 'flex-start',
              gap: '8px',
              fontSize: resolveFont(effectiveTextFont).fontSize,
              fontFamily: resolveFont(effectiveTextFont).fontFamily,
              color: textColorStr || '#1f1f1f',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: `1px solid ${widget.checked ? '#2f95e9' : '#c8ccd1'}`,
              background: widget.checked ? '#2f95e9' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              flexShrink: 0
            }}>
              {widget.checked ? '✓' : ''}
            </div>
            {checkboxText && <span>{checkboxText}</span>}
          </div>
        );
      
      case 'bar':
        const barValue = ((widget.value || 50) / (widget.max_value || 100)) * 100;
        return (
          <div style={{
            ...commonStyle,
            position: 'relative',
            padding: 0,
            background: '#cfe8f7',
            border: 'none',
            borderRadius: '999px'
          }}>
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: 2,
                bottom: 2,
                width: `${barValue}%`,
                background: '#2f95e9',
                borderRadius: 'inherit',
                minWidth: barValue > 0 ? 8 : 0
              }}
            />
          </div>
        );

      case 'led':
        const ledColorValue = (widget as any).color || widget.bg_color || { r: 80, g: 255, b: 120 };
        const ledColor = typeof ledColorValue === 'object' ? colorToRgb(ledColorValue) : parseHexColor(ledColorValue);
        const ledBrightness = Math.max(0.18, Math.min(1, (((widget as any).brightness ?? 255) / 255)));
        return (
          <div style={{
            ...commonStyle,
            borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.08)',
            background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), ${ledColor} 38%, rgba(0,0,0,0.22) 100%)`,
            boxShadow: `0 0 10px ${ledColor}`,
            opacity: ledBrightness,
            padding: 0
          }} />
        );
      
      case 'arc':
        return (
          <div style={{
            ...commonStyle,
            border: '4px solid #d9dee3',
            borderRadius: '50%',
            borderRightColor: '#2f95e9',
            borderBottomColor: '#2f95e9',
            fontSize: '16px',
            fontWeight: '500',
            background: '#ffffff',
            color: '#1f1f1f'
          }}>
            {widget.value || 50}
          </div>
        );
      
      case 'spinner':
        return (
          <div style={{
            ...commonStyle,
            border: '4px solid #e6e9ed',
            borderTop: '4px solid #2f95e9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            background: 'transparent'
          }}>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        );

      case 'meter':
        return renderMeterPreview();
      
      case 'line':
        const linePoints = widget.points || [[0, 0], [100, 0]];
        const lineColor = widget.line_color 
          ? (typeof widget.line_color === 'object' ? colorToRgb(widget.line_color) : parseHexColor(widget.line_color))
          : '#ffffff';
        const lineWidth = widget.line_width || 2;
        const lineDashWidth = (widget as any).line_dash_width;
        const lineDashGap = (widget as any).line_dash_gap;
        const lineRounded = (widget as any).line_rounded;
        
        // Build stroke dash array if dashes are specified
        const strokeDashArray = (lineDashWidth !== undefined && lineDashGap !== undefined) 
          ? `${lineDashWidth} ${lineDashGap}` 
          : undefined;
        
        // Convert points to SVG path
        const pathData = linePoints.map((point, idx) => 
          `${idx === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`
        ).join(' ');
        
        // Add padding to viewBox to prevent stroke clipping
        const strokePadding = Math.ceil(lineWidth / 2) + 1;
        const viewBoxWidth = boundsWidth + (strokePadding * 2);
        const viewBoxHeight = boundsHeight + (strokePadding * 2);
        
        // Render SVG with absolute coordinates (1:1 mapping with canvas pixels)
        return (
          <svg
            style={{
              position: 'absolute',
              top: -strokePadding,
              left: -strokePadding,
              width: boundsWidth + (strokePadding * 2),
              height: boundsHeight + (strokePadding * 2),
              overflow: 'visible',
              pointerEvents: 'none'
            }}
            viewBox={`${-strokePadding} ${-strokePadding} ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d={pathData}
              stroke={lineColor}
              strokeWidth={lineWidth}
              strokeDasharray={strokeDashArray}
              fill="none"
              strokeLinecap={lineRounded ? "round" : "square"}
              strokeLinejoin={lineRounded ? "round" : "miter"}
              style={{ pointerEvents: 'stroke' }}
            />
          </svg>
        );
      
      case 'obj':
        const objPadLeft = getSidePadding('left');
        const objPadRight = getSidePadding('right');
        const objPadTop = getSidePadding('top');
        const objPadBottom = getSidePadding('bottom');
        const objAutoSize = getAutoWidgetSize();
        const objRect = contentRef.current?.getBoundingClientRect();
        const objWidth = objRect?.width ? objRect.width / scaleFactor : (typeof objAutoSize.width === 'number' ? objAutoSize.width : boundsWidth);
        const objHeight = objRect?.height ? objRect.height / scaleFactor : (typeof objAutoSize.height === 'number' ? objAutoSize.height : boundsHeight);
        const contentWidth = Math.max(0, objWidth - objPadLeft - objPadRight);
        const contentHeight = Math.max(0, objHeight - objPadTop - objPadBottom);
        return (
          <div ref={contentRef} style={{
            ...commonStyle,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            position: 'relative'
          }}>
            {widget.widgets && widget.widgets.length > 0 ? (
              widget.widgets.map((childWidget, idx) => {
                const childPath = widgetPath && !isTopLayer ? `${widgetPath}.${idx}` : undefined;
                return (
                  <CanvasWidget
                    key={childWidget.id || idx}
                    widget={childWidget}
                    widgetPath={childPath}
                    isTopLayer={isTopLayer}
                    isSelected={!previewMode && Boolean(childPath) && selectedWidgetPath === childPath}
                    parentBounds={{
                      width: contentWidth,
                      height: contentHeight,
                      offsetX: objPadLeft,
                      offsetY: objPadTop,
                    }}
                  />
                );
              })
            ) : (
              <div style={{ fontSize: '11px', color: '#666', margin: 'auto' }}>
                Container (empty)
              </div>
            )}
          </div>
        );
      
      case 'image':
        return (
          <div style={{
            ...commonStyle,
            backgroundColor: '#1a1a1a',
            border: '1px dashed #555',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '32px',
            color: '#666'
          }}>
            🖼️
            <span style={{ fontSize: '10px', color: '#888' }}>
              {widget.src || 'image'}
            </span>
          </div>
        );
      
      case 'textarea':
        return (
          <div style={{
            ...commonStyle,
            padding: '8px',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            fontSize: resolveFont(effectiveTextFont).fontSize,
            fontFamily: resolveFont(effectiveTextFont).fontFamily,
            background: '#ffffff',
            color: '#1f1f1f',
            textAlign: 'left',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            border: '1px solid #d8dce0'
          }}>
            {widget.text || widget.placeholder || 'Text Area...'}
          </div>
        );

      case 'spinbox':
        const spinbox = widget as any;
        const spinboxValue = Number(spinbox.value ?? 0);
        const digitCount = Math.max(1, Number(spinbox.digit_count ?? 3));
        const decimalPlaces = Math.max(0, Number(spinbox.decimal_places ?? 0));
        const spinboxWidth = digitCount + (decimalPlaces > 0 ? decimalPlaces + 1 : 0);
        const spinboxDisplay = spinboxValue.toFixed(decimalPlaces).padStart(spinboxWidth, '0');
        return (
          <div style={{
            ...commonStyle,
            justifyContent: 'center',
            padding: '0 10px',
            background: '#ffffff',
            border: '1px solid #d8dce0',
            borderRadius: 8,
            fontFamily: resolveFont(effectiveTextFont).fontFamily,
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: '#2b2b2b'
          }}>
            <span>{spinboxDisplay}</span>
          </div>
        );

      case 'msgbox':
        const msgbox = widget as any;
        return (
          <div style={{
            ...commonStyle,
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            background: '#ffffff',
            color: '#222222',
            border: '1px solid #d8dce0',
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 500 }}>{msgbox.title || 'Messagebox'}</span>
              {msgbox.close_button !== false && (
                <span style={{
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: '#2f95e9',
                  color: '#ffffff',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  ×
                </span>
              )}
            </div>
            <div style={{
              fontSize: '13px',
              lineHeight: 1.25,
              marginBottom: '12px',
              whiteSpace: 'pre-wrap',
              color: '#333333',
              flex: 1
            }}>
              {msgbox.text || 'This is a sample messagebox.'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(msgbox.buttons || ['Apply']).slice(0, 2).map((buttonLabel: string, buttonIndex: number) => (
                <div
                  key={`${buttonLabel}-${buttonIndex}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 8px',
                    background: buttonIndex === 0 ? '#efefef' : '#f6f6f6',
                    border: '1px solid #d4d7db',
                    borderRadius: '6px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#2b2b2b'
                  }}
                >
                  {buttonLabel}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'dropdown':
        return (
          <div style={{
            ...commonStyle,
            justifyContent: 'space-between',
            padding: '0 10px 0 12px',
            background: '#ffffff',
            fontSize: resolveFont(effectiveTextFont).fontSize,
            fontFamily: resolveFont(effectiveTextFont).fontFamily,
            color: '#222222',
            border: '1px solid #d8dce0',
            borderRadius: '6px'
          }}>
            <span>{widget.options?.[widget.selected || 0] || 'Select'}</span>
            <span style={{ fontSize: '10px', opacity: 0.75, color: '#444' }}>▼</span>
          </div>
        );
      
      case 'roller':
        return (
          <div style={{
            ...commonStyle,
            flexDirection: 'column',
            fontSize: resolveFont(effectiveTextFont).fontSize,
            fontFamily: resolveFont(effectiveTextFont).fontFamily,
            padding: '6px',
            background: '#ffffff',
            border: '1px solid #d8dce0',
            color: '#222222',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: '50%',
              height: 26,
              transform: 'translateY(-50%)',
              borderRadius: 2,
              background: '#2f95e9'
            }} />
            {widget.options?.slice(0, widget.visible_row_count || 3).map((opt, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  opacity: idx === 1 ? 1 : 0.4,
                  padding: '2px 0',
                  fontWeight: idx === 1 ? '500' : '400',
                  color: idx === 1 ? '#ffffff' : '#444444'
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        );
      
      case 'buttonmatrix':
        const btnMatrix = widget as any;
        const rows = btnMatrix.rows || [];
        const matrixFont = resolveFont(effectiveTextFont);
        const matrixFontPx = Math.min(toPx(matrixFont.fontSize), 14) || 14;
        return (
          <div style={{
            ...commonStyle,
            flexDirection: 'column',
            padding: `${effectivePadAll}px`,
            gap: '2px',
            alignItems: 'stretch',
            backgroundColor: 'transparent',
            background: backgroundStyle,
            overflow: 'hidden'
          }}>
            {rows.map((row: any, rowIdx: number) => (
              <div
                key={rowIdx}
                style={{
                  display: 'flex',
                  gap: '2px',
                  flex: 1,
                  width: '100%',
                  minWidth: 0
                }}
              >
                {row.buttons?.map((btn: any, btnIdx: number) => (
                  <div
                    key={btnIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      const then = btn.on_press?.then ?? btn.on_click?.then;
                      if (then) executePageAction(then);
                      else if (btn.on_press) executePageAction(btn.on_press);
                    }}
                    style={{
                      flex: btn.width || 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.06)',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: effectiveRadius ? `${effectiveRadius}px` : '0px',
                      padding: '3px 6px',
                      minWidth: 0,
                      fontSize: `${matrixFontPx}px`,
                      fontFamily: matrixFont.fontFamily,
                      fontWeight: '500',
                      color: textColorStr,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                      letterSpacing: '0.01em',
                      userSelect: 'none'
                    }}
                  >
                    {btn.text || 'Button'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <div style={{
            ...commonStyle,
            fontSize: '11px',
            color: '#888'
          }}>
            {(widget as any).type}
          </div>
        );
    }
  };

  // Calculate position based on alignment
  const getAlignedPosition = () => {
    // Line widgets use points for positioning, not x/y/width/height
    if (widget.type === 'line') {
      return { left: boundsOffsetX, top: boundsOffsetY };
    }
    
    const parentWidth = boundsWidth;
    const parentHeight = boundsHeight;
    const autoSize = getAutoWidgetSize();
    
    // Get actual widget size - prioritize actual DOM dimensions for accuracy
    let widgetWidth = 100; // default
    let widgetHeight = 50; // default
    
    // First try to get from DOM (most accurate)
    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      if (rect.width > 0) widgetWidth = rect.width / scaleFactor;
      if (rect.height > 0) widgetHeight = rect.height / scaleFactor;
    } 
    // Then try widget properties
    else if (typeof autoSize.width === 'number') {
      widgetWidth = autoSize.width;
    }
    if (typeof autoSize.height === 'number' && (!widgetRef.current || widgetRef.current.getBoundingClientRect().height === 0)) {
      widgetHeight = autoSize.height;
    }
    
    let left = widget.x || 0;
    let top = widget.y || 0;

    if (widget.align) {
      const align = widget.align.toUpperCase();
      
      // Horizontal alignment
      if (align.includes('LEFT') && !align.includes('OUT_')) {
        left = (widget.x || 0);
      } else if (align.includes('RIGHT')) {
        if (align.includes('OUT_')) {
          left = parentWidth + (widget.x || 0);
        } else {
          // For RIGHT alignment: position from right edge
          // If x is negative, it's an offset from the right
          // If x is 0, widget right edge touches screen right edge
          left = parentWidth - widgetWidth + (widget.x || 0);
        }
      } else if (align.includes('CENTER') || align.includes('_MID')) {
        left = (parentWidth - widgetWidth) / 2 + (widget.x || 0);
      }
      
      // Vertical alignment
      if (align.includes('TOP') && !align.includes('OUT_')) {
        top = (widget.y || 0);
      } else if (align.includes('BOTTOM')) {
        if (align.includes('OUT_')) {
          top = parentHeight + (widget.y || 0);
        } else {
          // For BOTTOM alignment: position from bottom edge
          // If y is negative, it's an offset from the bottom
          // If y is 0, widget bottom edge touches screen bottom edge
          top = parentHeight - widgetHeight + (widget.y || 0);
        }
      } else if (align === 'CENTER' || (align.includes('MID') && !align.includes('TOP') && !align.includes('BOTTOM')) || align.includes('_LEFT') || align.includes('_RIGHT')) {
        // Only center vertically if it's explicitly CENTER or has MID without TOP/BOTTOM
        if (!align.includes('OUT_')) {
          top = (parentHeight - widgetHeight) / 2 + (widget.y || 0);
        }
      }
      
      // Special cases for OUT_ alignments
      if (align.includes('OUT_TOP') && !align.includes('BOTTOM')) {
        top = -(widgetHeight) + (widget.y || 0);
      } else if (align.includes('OUT_LEFT') && !align.includes('RIGHT')) {
        left = -(widgetWidth) + (widget.x || 0);
      }
    }

    return { left: left + boundsOffsetX, top: top + boundsOffsetY };
  };

  const { left, top } = getAlignedPosition();
  const autoSize = getAutoWidgetSize();

  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    width: '8px',
    height: '8px',
    backgroundColor: '#61dafb',
    border: '1px solid #fff',
    borderRadius: '2px',
    zIndex: 10,
    boxShadow: '0 0 3px rgba(0,0,0,0.5)'
  };

  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left,
        top,
        // Line widgets use full canvas size and points for positioning
        // Labels/text widgets: no explicit size → let CSS set max-content so text isn't clipped
        width: widget.type === 'line' ? boundsWidth
          : (autoSize.width ? (typeof autoSize.width === 'number' ? autoSize.width : autoSize.width)
            : (widget.type === 'label' ? 'max-content' : 'auto')),
        height: widget.type === 'line' ? boundsHeight
          : (autoSize.height ? (typeof autoSize.height === 'number' ? autoSize.height : autoSize.height)
            : (widget.type === 'label' ? 'max-content' : 'auto')),
        minWidth: (widget.type === 'line' || widget.type === 'label' || autoSize.width) ? undefined : '20px',
        minHeight: (widget.type === 'line' || widget.type === 'label' || autoSize.height) ? undefined : '20px',
        cursor: widget.type === 'line' ? 'default' : (isDragging ? 'grabbing' : 'grab'),
        outline: isSelected ? '2px solid #61dafb' : 'none',
        outlineOffset: '2px',
        opacity: showHiddenGhost ? 0.45 : 1,
        filter: showHiddenGhost ? 'grayscale(0.18)' : 'none',
        boxSizing: 'border-box',
        transition: isDragging || isResizing ? 'none' : 'outline 0.15s ease'
      }}
      title={showHiddenGhost ? 'Hidden widget' : undefined}
    >
      {showHiddenGhost && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '1px dashed rgba(255,255,255,0.45)',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          zIndex: 2
        }} />
      )}
      {renderWidget()}
      
      {isSelected && (
        <>
          {/* Alignment anchor point crosshair */}
          {widget.align && widget.type !== 'line' && (() => {
            const align = widget.align.toUpperCase();
            let anchorX = '0%';
            let anchorY = '0%';
            
            // Horizontal anchor position
            if (align.includes('LEFT')) {
              anchorX = '0%';
            } else if (align.includes('RIGHT')) {
              anchorX = '100%';
            } else if (align.includes('CENTER') || align.includes('_MID')) {
              anchorX = '50%';
            }
            
            // Vertical anchor position
            if (align.includes('TOP')) {
              anchorY = '0%';
            } else if (align.includes('BOTTOM')) {
              anchorY = '100%';
            } else if (align === 'CENTER' || align.includes('MID') && !align.includes('TOP') && !align.includes('BOTTOM')) {
              anchorY = '50%';
            }
            
            return (
              <div style={{
                position: 'absolute',
                left: anchorX,
                top: anchorY,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 20
              }}>
                {/* Crosshair */}
                <div style={{
                  position: 'absolute',
                  width: '12px',
                  height: '1px',
                  backgroundColor: '#ff4444',
                  left: '-6px',
                  top: '0'
                }} />
                <div style={{
                  position: 'absolute',
                  width: '1px',
                  height: '12px',
                  backgroundColor: '#ff4444',
                  left: '0',
                  top: '-6px'
                }} />
                {/* Center dot */}
                <div style={{
                  position: 'absolute',
                  width: '3px',
                  height: '3px',
                  backgroundColor: '#ff4444',
                  borderRadius: '50%',
                  left: '-1.5px',
                  top: '-1.5px'
                }} />
              </div>
            );
          })()}

          {/* Position indicator */}
          {widget.type !== 'line' && (
            <div
              style={{
                position: 'absolute',
                bottom: -22,
                right: 0,
                fontSize: '10px',
                color: '#61dafb',
                backgroundColor: '#1e1e1e',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                border: '1px solid #61dafb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {widget.align 
                ? `${widget.align} (${widget.x || 0}, ${widget.y || 0}) → [${Math.round(left)}, ${Math.round(top)}]` 
                : `${widget.x || 0}, ${widget.y || 0}`}
            </div>
          )}

          {/* Size indicator */}
          {widget.type !== 'line' && (
            <div
              style={{
                position: 'absolute',
                top: -22,
                left: 0,
                fontSize: '10px',
                color: '#61dafb',
                backgroundColor: '#1e1e1e',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                border: '1px solid #61dafb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {widget.width || 100}×{widget.height || 50}
            </div>
          )}

          {/* Resize handles - not for line widgets */}
          {widget.type !== 'line' && (
            <>
              {/* Top-left */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'nw')}
                style={{ ...resizeHandleStyle, top: -4, left: -4, cursor: 'nw-resize' }}
              />
              {/* Top */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'n')}
                style={{ ...resizeHandleStyle, top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' }}
              />
              {/* Top-right */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'ne')}
                style={{ ...resizeHandleStyle, top: -4, right: -4, cursor: 'ne-resize' }}
              />
              {/* Right */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'e')}
                style={{ ...resizeHandleStyle, top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'e-resize' }}
              />
              {/* Bottom-right */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'se')}
                style={{ ...resizeHandleStyle, bottom: -4, right: -4, cursor: 'se-resize' }}
              />
              {/* Bottom */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 's')}
                style={{ ...resizeHandleStyle, bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' }}
              />
              {/* Bottom-left */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'sw')}
                style={{ ...resizeHandleStyle, bottom: -4, left: -4, cursor: 'sw-resize' }}
              />
              {/* Left */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'w')}
                style={{ ...resizeHandleStyle, top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'w-resize' }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
