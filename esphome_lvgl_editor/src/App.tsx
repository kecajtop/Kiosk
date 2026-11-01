import { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { WidgetPalette } from './components/WidgetPalette';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CodeEditor } from './components/CodeEditor';
import { Toolbar } from './components/Toolbar';
import { WidgetIdList } from './components/WidgetIdList';
import { DebugConsole } from './components/DebugConsole';
import { PageSelector } from './components/PageSelector';
import { StylesPanel } from './components/StylesPanel';
import { PageTree } from './components/PageTree';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditorStore } from './store/editorStore';

type ViewMode = 'visual' | 'code' | 'split';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [showStylesPanel, setShowStylesPanel] = useState(false);
  const { showPageTree } = useEditorStore();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <Toolbar viewMode={viewMode} onViewModeChange={setViewMode} onShowStylesPanel={() => setShowStylesPanel(!showStylesPanel)} />
        <PageSelector />
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {showStylesPanel && viewMode === 'visual' && (
            <StylesPanel />
          )}
          
          {(viewMode === 'visual' || viewMode === 'split') && (
            <>
              {showPageTree && <PageTree />}
              <WidgetPalette />
              <Canvas />
              <PropertiesPanel />
              <WidgetIdList />
            </>
          )}
          
          {viewMode === 'code' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <CodeEditor />
            </div>
          )}
          
          {viewMode === 'split' && (
            <div style={{ 
              width: '50%', 
              borderLeft: '1px solid #333',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#2c2c2c',
                borderBottom: '1px solid #444',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ccc'
              }}>
                YAML Code
              </div>
              <CodeEditor />
            </div>
          )}
        </div>

        <DebugConsole />
      </div>
    </DndProvider>
  );
}

export default App;
