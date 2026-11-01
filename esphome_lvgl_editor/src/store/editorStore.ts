import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Widget, Page, LVGLConfig, StyleDefinition, CompatibilityIssue } from '../types/widgets';

interface HistoryState {
  config: LVGLConfig;
  currentPageId: string;
  selectedWidgetId: string | null;
}

interface EditorState {
  config: LVGLConfig;
  currentPageId: string;
  selectedWidgetId: string | null;
  selectedWidgetPath: string | null;
  displaySize: { width: number; height: number };
  previewScale: number;
  snapToGrid: boolean;
  snapSize: number;
  previewMode: boolean;
  showPageTree: boolean;
  editMode: 'pages' | 'top_layer';
  /** Raw full ESPHome YAML if a full file was imported; null if LVGL-only */
  rawEsphomeYaml: string | null;
  /** Compatibility issues found during last import */
  lastImportIssues: CompatibilityIssue[];
  /** Relative path (under the add-on's ESPHome folder) of the file currently open for editing, if any */
  openEsphomePath: string | null;
  history: HistoryState[];
  historyIndex: number;
  
  // Actions
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  deleteWidget: (id: string) => void;
  selectWidget: (id: string | null) => void;
  setCurrentPage: (pageId: string) => void;
  addPage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  renamePage: (oldId: string, newId: string) => void;
  addStyle: (style: StyleDefinition) => void;
  updateStyle: (styleId: string, updates: Partial<StyleDefinition>) => void;
  deleteStyle: (styleId: string) => void;
  addTopLayerWidget: (widget: Widget) => void;
  updateTopLayerWidget: (id: string, updates: Partial<Widget>) => void;
  deleteTopLayerWidget: (id: string) => void;
  setDisplaySize: (size: { width: number; height: number }) => void;
  setPreviewScale: (scale: number) => void;
  loadConfig: (config: LVGLConfig) => void;
  getCurrentPage: () => Page | undefined;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Nested widget management
  selectWidgetByPath: (path: string | null) => void;
  addNestedWidget: (parentPath: string, widget: Widget) => void;
  updateNestedWidget: (path: string, updates: Partial<Widget>) => void;
  deleteNestedWidget: (path: string) => void;
  getWidgetByPath: (path: string) => Widget | null;
  setSnapToGrid: (snap: boolean) => void;
  setSnapSize: (size: number) => void;
  setPreviewMode: (preview: boolean) => void;
  setShowPageTree: (show: boolean) => void;
  setEditMode: (mode: 'pages' | 'top_layer') => void;
  setRawEsphomeYaml: (raw: string | null) => void;
  setLastImportIssues: (issues: CompatibilityIssue[]) => void;
  setOpenEsphomePath: (path: string | null) => void;
}

const MAX_HISTORY = 50;

const saveHistory = (state: EditorState): Partial<EditorState> => {
  const snapshot: HistoryState = {
    config: JSON.parse(JSON.stringify(state.config)),
    currentPageId: state.currentPageId,
    selectedWidgetId: state.selectedWidgetId
  };
  
  // Remove any future history if we're not at the end
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(snapshot);
  
  // Limit history size
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1
  };
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
  config: {
    pages: [
      {
        id: 'main_page',
        widgets: []
      }
    ]
  },
  currentPageId: 'main_page',
  selectedWidgetId: null,
  selectedWidgetPath: null,
  displaySize: { width: 320, height: 240 },
  previewScale: 100,
  snapToGrid: true,
  snapSize: 5,
  previewMode: false,
  showPageTree: true,
  editMode: 'pages',
  rawEsphomeYaml: null,
  lastImportIssues: [],
  openEsphomePath: null,
  history: [],
  historyIndex: -1,

  addWidget: (widget: Widget) => {
    set((state) => {
      // Generate ID if not provided
      if (!widget.id) {
        const page = state.config.pages.find(p => p.id === state.currentPageId);
        const existingCount = page?.widgets.filter(w => w.type === widget.type).length || 0;
        widget.id = `${widget.type}_${existingCount + 1}`;
      }
      
      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          return {
            ...page,
            widgets: [...page.widgets, widget]
          };
        }
        return page;
      });
      return {
        config: { ...state.config, pages },
        selectedWidgetId: widget.id
      };
    });
  },

  updateWidget: (id: string, updates: Partial<Widget>) => {
    set((state) => {
      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          return {
            ...page,
            widgets: page.widgets.map((widget) =>
              widget.id === id ? { ...widget, ...updates } as Widget : widget
            )
          };
        }
        return page;
      });
      return { config: { ...state.config, pages } };
    });
  },

  deleteWidget: (id: string) => {
    set((state) => {
      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          return {
            ...page,
            widgets: page.widgets.filter((widget) => widget.id !== id)
          };
        }
        return page;
      });
      return {
        config: { ...state.config, pages },
        selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId
      };
    });
  },

  selectWidget: (id: string | null) => {
    set({ selectedWidgetId: id, selectedWidgetPath: null });
  },

  setCurrentPage: (pageId: string) => {
    set({ currentPageId: pageId, selectedWidgetId: null, selectedWidgetPath: null });
  },
  
  addPage: (pageId: string) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          pages: [...state.config.pages, { id: pageId, widgets: [] }]
        },
        ...historyUpdate
      };
    });
  },

  deletePage: (pageId: string) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      const newPages = state.config.pages.filter(p => p.id !== pageId);
      const newCurrentPageId = state.currentPageId === pageId 
        ? (newPages[0]?.id || 'page1')
        : state.currentPageId;
      
      return {
        config: {
          ...state.config,
          pages: newPages
        },
        currentPageId: newCurrentPageId,
        selectedWidgetId: null,
        ...historyUpdate
      };
    });
  },

  renamePage: (oldId: string, newId: string) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          pages: state.config.pages.map(page => 
            page.id === oldId ? { ...page, id: newId } : page
          )
        },
        currentPageId: state.currentPageId === oldId ? newId : state.currentPageId,
        ...historyUpdate
      };
    });
  },
  setDisplaySize: (size: { width: number; height: number }) => {
    set({ displaySize: size });
  },

  setPreviewScale: (scale: number) => {
    set({ previewScale: Math.max(100, Math.min(200, Math.round(scale))) });
  },

  loadConfig: (config: LVGLConfig) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config,
        currentPageId: config.pages[0]?.id || 'main_page',
        selectedWidgetId: null,
        selectedWidgetPath: null,
        ...historyUpdate
      };
    });
  },

  getCurrentPage: () => {
    const state = get();
    return state.config.pages.find((page) => page.id === state.currentPageId);
  },

  addStyle: (style: StyleDefinition) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          style_definitions: [...(state.config.style_definitions || []), style]
        },
        ...historyUpdate
      };
    });
  },

  updateStyle: (styleId: string, updates: Partial<StyleDefinition>) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          style_definitions: (state.config.style_definitions || []).map(style =>
            style.id === styleId ? { ...style, ...updates } : style
          )
        },
        ...historyUpdate
      };
    });
  },

  deleteStyle: (styleId: string) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          style_definitions: (state.config.style_definitions || []).filter(s => s.id !== styleId)
        },
        ...historyUpdate
      };
    });
  },

  addTopLayerWidget: (widget: Widget) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      if (!widget.id) {
        const existingCount = state.config.top_layer?.widgets.filter(w => w.type === widget.type).length || 0;
        widget.id = `${widget.type}_toplayer_${existingCount + 1}`;
      }
      
      return {
        config: {
          ...state.config,
          top_layer: {
            widgets: [...(state.config.top_layer?.widgets || []), widget]
          }
        },
        selectedWidgetId: widget.id,
        ...historyUpdate
      };
    });
  },

  updateTopLayerWidget: (id: string, updates: Partial<Widget>) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          top_layer: {
            widgets: (state.config.top_layer?.widgets || []).map(widget =>
              widget.id === id ? { ...widget, ...updates } as Widget : widget
            )
          }
        },
        ...historyUpdate
      };
    });
  },

  deleteTopLayerWidget: (id: string) => {
    set((state) => {
      const historyUpdate = saveHistory(state);
      
      return {
        config: {
          ...state.config,
          top_layer: {
            widgets: (state.config.top_layer?.widgets || []).filter(w => w.id !== id)
          }
        },
        selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId,
        ...historyUpdate
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      set({
        config: JSON.parse(JSON.stringify(snapshot.config)),
        currentPageId: snapshot.currentPageId,
        selectedWidgetId: snapshot.selectedWidgetId,
        selectedWidgetPath: null,
        historyIndex: newIndex
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      set({
        config: JSON.parse(JSON.stringify(snapshot.config)),
        currentPageId: snapshot.currentPageId,
        selectedWidgetId: snapshot.selectedWidgetId,
        selectedWidgetPath: null,
        historyIndex: newIndex
      });
    }
  },

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  // Nested widget management
  selectWidgetByPath: (path: string | null) => {
    set({ selectedWidgetPath: path, selectedWidgetId: null });
  },

  getWidgetByPath: (path: string) => {
    const state = get();
    const page = state.config.pages.find(p => p.id === state.currentPageId);
    if (!page) return null;

    const indices = path.split('.').map(Number);
    let current: any = { widgets: page.widgets };
    
    for (const index of indices) {
      if (!current.widgets || !current.widgets[index]) return null;
      current = current.widgets[index];
    }
    
    return current as Widget;
  },

  addNestedWidget: (parentPath: string, widget: Widget) => {
    set((state) => {
      // Generate ID if not provided
      if (!widget.id) {
        const timestamp = Date.now();
        widget.id = `${widget.type}_${timestamp}`;
      }

      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          const indices = parentPath.split('.').map(Number);
          const newWidgets = JSON.parse(JSON.stringify(page.widgets));
          
          let current: any = { widgets: newWidgets };
          for (const index of indices) {
            current = current.widgets[index];
          }
          
          if (current.type === 'obj') {
            if (!current.widgets) current.widgets = [];
            current.widgets.push(widget);
          }
          
          return { ...page, widgets: newWidgets };
        }
        return page;
      });
      
      return {
        config: { ...state.config, pages },
        ...saveHistory({ ...state, config: { ...state.config, pages } })
      };
    });
  },

  updateNestedWidget: (path: string, updates: Partial<Widget>) => {
    set((state) => {
      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          const indices = path.split('.').map(Number);
          const newWidgets = JSON.parse(JSON.stringify(page.widgets));
          
          let current: any = { widgets: newWidgets };
          for (let i = 0; i < indices.length - 1; i++) {
            current = current.widgets[indices[i]];
          }
          
          const lastIndex = indices[indices.length - 1];
          current.widgets[lastIndex] = {
            ...current.widgets[lastIndex],
            ...updates
          };
          
          return { ...page, widgets: newWidgets };
        }
        return page;
      });
      
      return {
        config: { ...state.config, pages },
        ...saveHistory({ ...state, config: { ...state.config, pages } })
      };
    });
  },

  deleteNestedWidget: (path: string) => {
    set((state) => {
      const pages = state.config.pages.map((page) => {
        if (page.id === state.currentPageId) {
          const indices = path.split('.').map(Number);
          const newWidgets = JSON.parse(JSON.stringify(page.widgets));
          
          let current: any = { widgets: newWidgets };
          for (let i = 0; i < indices.length - 1; i++) {
            current = current.widgets[indices[i]];
          }
          
          const lastIndex = indices[indices.length - 1];
          current.widgets.splice(lastIndex, 1);
          
          return { ...page, widgets: newWidgets };
        }
        return page;
      });
      
      return {
        config: { ...state.config, pages },
        selectedWidgetPath: null,
        ...saveHistory({ ...state, config: { ...state.config, pages } })
      };
    });
  },

  setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
  setSnapSize: (size: number) => set({ snapSize: size }),
  setPreviewMode: (preview: boolean) => set({ previewMode: preview }),
  setShowPageTree: (show: boolean) => set({ showPageTree: show }),
  setEditMode: (mode: 'pages' | 'top_layer') => set({ editMode: mode }),
  setRawEsphomeYaml: (raw: string | null) => set({ rawEsphomeYaml: raw }),
  setLastImportIssues: (issues: CompatibilityIssue[]) => set({ lastImportIssues: issues }),
  setOpenEsphomePath: (path: string | null) => set({ openEsphomePath: path }),
    }),
    {
      name: 'esphome-lvgl-editor-state',
      // Only persist the data that should survive a refresh
      partialize: (state) => ({
        config: state.config,
        currentPageId: state.currentPageId,
        displaySize: state.displaySize,
        previewScale: state.previewScale,
        rawEsphomeYaml: state.rawEsphomeYaml,
        openEsphomePath: state.openEsphomePath,
        snapToGrid: state.snapToGrid,
        snapSize: state.snapSize,
        showPageTree: state.showPageTree,
        editMode: state.editMode,
      }),
    }
  )
);

