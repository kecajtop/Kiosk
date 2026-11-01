import React, { useEffect, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useEditorStore } from '../store/editorStore';
import { Widget, WidgetType } from '../types/widgets';
import { WidgetConfig } from '../types/widgets';
import { CanvasWidget } from './CanvasWidget';
import { parseHexColor } from '../utils/colorUtils';

export const Canvas: React.FC = () => {
  const { displaySize, previewScale, addWidget, getCurrentPage, selectedWidgetId, selectedWidgetPath, selectWidget, config, previewMode, snapToGrid, snapSize, editMode, addTopLayerWidget, currentPageId, setCurrentPage } = useEditorStore();
  const currentPage = getCurrentPage();
  const topLayerWidgets = config.top_layer?.widgets || [];
  const pages = config.pages || [];
  const currentPageIndex = pages.findIndex(p => p.id === currentPageId);
  const scaleFactor = previewScale / 100;

  const goToPrevPage = useCallback(() => {
    if (currentPageIndex > 0) setCurrentPage(pages[currentPageIndex - 1].id);
  }, [currentPageIndex, pages, setCurrentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) setCurrentPage(pages[currentPageIndex + 1].id);
  }, [currentPageIndex, pages, setCurrentPage]);

  // Keyboard navigation: arrow keys for prev/next page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goToPrevPage(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goToNextPage(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToPrevPage, goToNextPage]);

  const [, drop] = useDrop(() => ({
    accept: 'widget',
    drop: (item: { config: WidgetConfig }, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset) {
        const canvasElement = document.getElementById('canvas');
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          // Calculate position relative to canvas
          let x = (offset.x - canvasRect.left) / scaleFactor;
          let y = (offset.y - canvasRect.top) / scaleFactor;
          
          // Ensure widget stays within canvas bounds
          const widgetWidth = typeof item.config.defaultProps.width === 'number' ? item.config.defaultProps.width : 100;
          const widgetHeight = typeof item.config.defaultProps.height === 'number' ? item.config.defaultProps.height : 50;
          x = Math.max(0, Math.min(x, displaySize.width - widgetWidth));
          y = Math.max(0, Math.min(y, displaySize.height - widgetHeight));

          // Generate meaningful ID
          const timestamp = Date.now();
          const widgetId = `${item.config.type}_${timestamp}`;

          const newWidget: Widget = {
            ...item.config.defaultProps,
            id: widgetId,
            type: item.config.type as WidgetType,
            x: Math.round(x),
            y: Math.round(y)
          } as Widget;

          if (editMode === 'top_layer') {
            addTopLayerWidget(newWidget);
          } else {
            addWidget(newWidget);
          }
        }
      }
    },
  }));

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectWidget(null);
    }
  };

  // Get LVGL background color from config
  const bgColor = config.bg_color ? parseHexColor(config.bg_color) : '#000000';
  const navButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    background: 'linear-gradient(180deg, rgba(15,23,34,0.88), rgba(10,15,23,0.78))',
    color: '#d8f0ff',
    cursor: 'pointer',
    borderRadius: '999px',
    fontSize: 18,
    fontWeight: 700,
    userSelect: 'none',
    border: '1px solid rgba(114, 181, 224, 0.28)',
    boxShadow: '0 8px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
    opacity: 0.72,
    transition: 'opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease'
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: previewMode ? '#000' : '#252526',
        padding: previewMode ? '0' : '20px',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      {/* Display size indicator - positioned outside the canvas */}
      {!previewMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '12px',
          color: '#fff',
          backgroundColor: '#1e1e1e',
          padding: '4px 12px',
          borderRadius: '4px',
          border: '1px solid #444',
          zIndex: 1000,
          fontWeight: 500
        }}>
          {displaySize.width} × {displaySize.height} px
        </div>
      )}
      
      <div
        style={{
          width: displaySize.width * scaleFactor,
          height: displaySize.height * scaleFactor,
          position: 'relative',
          flexShrink: 0
        }}
      >
        <div
          id="canvas"
          ref={drop}
          onClick={handleCanvasClick}
          style={{
            width: displaySize.width,
            height: displaySize.height,
            backgroundColor: bgColor,
            position: 'relative',
            border: previewMode ? 'none' : '2px solid #444',
            boxShadow: previewMode ? 'none' : '0 4px 20px rgba(0,0,0,0.5)',
            cursor: 'default',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            overflow: 'hidden',
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left'
          }}
        >
        
        {/* Show welcome message if no pages */}
        {(!config.pages || config.pages.length === 0 || !currentPage) && editMode === 'pages' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#888',
            fontSize: '16px',
            pointerEvents: 'none'
          }}>
            <div style={{ marginBottom: '20px', fontSize: '48px' }}>📄</div>
            <div style={{ marginBottom: '16px', fontWeight: 600, color: '#ccc' }}>
              No configuration loaded
            </div>
            <div style={{ marginBottom: '8px' }}>
              Click "Import YAML" in the toolbar to get started
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              or drag widgets from the palette to create a new design
            </div>
          </div>
        )}
        
        {/* Render page widgets when in pages mode */}
        {editMode === 'pages' && currentPage?.widgets.map((widget, index) => (
          <CanvasWidget
            key={widget.id}
            widget={widget}
            widgetPath={`${index}`}
            isSelected={!previewMode && selectedWidgetPath === `${index}`}
          />
        ))}
        
        {/* Top layer widgets - always rendered but only editable in top_layer mode */}
        {topLayerWidgets.map((widget) => (
          <CanvasWidget
            key={widget.id}
            widget={widget}
            isSelected={!previewMode && editMode === 'top_layer' && widget.id === selectedWidgetId}
            isTopLayer={true}
          />
        ))}

        {/* Page navigation overlay — prev/next arrows + page indicator */}
        {pages.length > 1 && (
          <>
            {/* Left arrow */}
            {currentPageIndex > 0 && (
              <div
                onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
                title="Previous page (←)"
                style={{
                  ...navButtonStyle,
                  left: 8,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.72';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)';
                }}
              >‹</div>
            )}
            {/* Right arrow */}
            {currentPageIndex < pages.length - 1 && (
              <div
                onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
                title="Next page (→)"
                style={{
                  ...navButtonStyle,
                  right: 8,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.04)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.72';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)';
                }}
              >›</div>
            )}
            {/* Page indicator */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 500,
                display: 'flex',
                gap: 6,
                pointerEvents: 'none',
                padding: '5px 10px',
                borderRadius: 999,
                background: 'linear-gradient(180deg, rgba(8,12,18,0.78), rgba(8,12,18,0.5))',
                border: '1px solid rgba(114, 181, 224, 0.18)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.24)'
              }}
            >
              {pages.map((p, i) => (
                <div
                  key={p.id}
                  title={p.id}
                  style={{
                    width: i === currentPageIndex ? 18 : 7,
                    height: 7,
                    borderRadius: 999,
                    background: i === currentPageIndex
                      ? 'linear-gradient(90deg, #78d6ff, #2f8cd8)'
                      : 'rgba(255,255,255,0.26)',
                    boxShadow: i === currentPageIndex ? '0 0 10px rgba(68, 186, 255, 0.38)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>
          </>
        )}
        
        {/* Grid overlay */}
        {!previewMode && snapToGrid && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.1
            }}
          >
            <defs>
              <pattern id="grid" width={snapSize} height={snapSize} patternUnits="userSpaceOnUse">
                <path d={`M ${snapSize} 0 L 0 0 0 ${snapSize}`} fill="none" stroke="#666" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}
        </div>
      </div>
    </div>
  );
};
