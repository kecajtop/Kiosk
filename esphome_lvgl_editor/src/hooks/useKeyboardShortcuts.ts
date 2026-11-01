import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export const useKeyboardShortcuts = () => {
  const { undo, redo, canUndo, canRedo, selectedWidgetId, updateWidget, updateTopLayerWidget, editMode, config, snapToGrid, snapSize } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields or code editor
      const target = e.target as HTMLElement;
      if (target.closest('.monaco-editor') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Arrow keys to move selected widget
      if (selectedWidgetId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        // Find the widget
        let widget = null;
        if (editMode === 'top_layer' && config.top_layer) {
          widget = config.top_layer.widgets.find(w => w.id === selectedWidgetId);
        } else {
          const currentPage = config.pages.find(p => p.id === useEditorStore.getState().currentPageId);
          if (currentPage) {
            widget = currentPage.widgets.find(w => w.id === selectedWidgetId);
          }
        }
        
        if (widget) {
          // Determine movement amount (larger with Shift key)
          const moveAmount = e.shiftKey ? 10 : 1;
          
          let dx = 0;
          let dy = 0;
          
          switch (e.key) {
            case 'ArrowUp':
              dy = -moveAmount;
              break;
            case 'ArrowDown':
              dy = moveAmount;
              break;
            case 'ArrowLeft':
              dx = -moveAmount;
              break;
            case 'ArrowRight':
              dx = moveAmount;
              break;
          }
          
          const updateFn = editMode === 'top_layer' ? updateTopLayerWidget : updateWidget;
          updateFn(selectedWidgetId, {
            x: widget.x + dx,
            y: widget.y + dy
          });
        }
        return;
      }
      
      // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (canUndo()) {
          e.preventDefault();
          undo();
          console.log('Undo triggered');
        }
      }
      
      // Redo: Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac/Windows/Linux)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        if (canRedo()) {
          e.preventDefault();
          redo();
          console.log('Redo triggered');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, selectedWidgetId, updateWidget, updateTopLayerWidget, editMode, config, snapToGrid, snapSize]);
};
