import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../store/editorStore';
import { configToPagesYaml, yamlToConfig } from '../utils/yamlConverter';
import { AlertCircle, CheckCircle, Save, FileCode } from 'lucide-react';

export const CodeEditor: React.FC = () => {
  const { config, loadConfig, selectedWidgetId, rawEsphomeYaml } = useEditorStore();
  const editorRef = useRef<any>(null);
  const isUpdatingFromEditor = useRef(false);
  const [editorValue, setEditorValue] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const parseTimeoutRef = useRef<any>(null);
  const decorationsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!isUpdatingFromEditor.current) {
      const newYaml = configToPagesYaml(config);
      setEditorValue(newYaml);
      setHasUnsavedChanges(false);
    }
  }, [config]);

  // Highlight selected widget in code
  useEffect(() => {
    if (!editorRef.current || !selectedWidgetId) {
      // Clear decorations if no widget selected
      if (decorationsRef.current.length > 0 && editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    // Find the widget in the YAML text
    const lines = editorValue.split('\n');
    let startLine = -1;
    let endLine = -1;
    let currentIndent = -1;
    
    // Look for the widget ID in the YAML
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`- id: ${selectedWidgetId}`)) {
        startLine = i + 1; // Monaco uses 1-based line numbers
        currentIndent = line.search(/\S/); // Get indentation level
        
        // Find the end of this widget block
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const nextIndent = nextLine.search(/\S/);
          
          // End when we find a line with same or less indentation (or empty line followed by same/less indent)
          if (nextLine.trim() && nextIndent <= currentIndent) {
            endLine = j;
            break;
          }
        }
        
        if (endLine === -1) {
          endLine = lines.length;
        }
        break;
      }
    }

    if (startLine !== -1 && typeof window !== 'undefined' && (window as any).monaco) {
      const monaco = (window as any).monaco;
      // Apply highlighting decoration
      const newDecorations = [
        {
          range: new monaco.Range(startLine, 1, endLine, 1),
          options: {
            isWholeLine: true,
            className: 'highlighted-widget-line',
            glyphMarginClassName: 'highlighted-widget-glyph'
          }
        }
      ];

      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, newDecorations);
      
      // Scroll to the highlighted region
      editorRef.current.revealLineInCenter(startLine);
    }
  }, [selectedWidgetId, editorValue]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
      handleApplyChanges();
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    
    setEditorValue(value);
    setHasUnsavedChanges(true);
    
    // Clear existing timeout
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }
    
    // Debounce parsing
    parseTimeoutRef.current = setTimeout(() => {
      try {
        yamlToConfig(value); // Just validate, don't apply yet
        setParseError(null);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Invalid YAML syntax');
      }
    }, 500);
  };

  const handleApplyChanges = () => {
    try {
      const newConfig = yamlToConfig(editorValue);
      isUpdatingFromEditor.current = true;
      loadConfig(newConfig);
      setParseError(null);
      setHasUnsavedChanges(false);
      setTimeout(() => {
        isUpdatingFromEditor.current = false;
      }, 100);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid YAML syntax');
    }
  };

  const handleRevert = () => {
    const currentYaml = configToPagesYaml(config);
    setEditorValue(currentYaml);
    setHasUnsavedChanges(false);
    setParseError(null);
    if (editorRef.current) {
      editorRef.current.setValue(currentYaml);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Add CSS for highlighting */}
      <style>{`
        .highlighted-widget-line {
          background-color: rgba(97, 218, 251, 0.15) !important;
          border-left: 3px solid #61dafb !important;
        }
        .highlighted-widget-glyph {
          background-color: #61dafb !important;
          width: 3px !important;
        }
      `}</style>

      {/* Full-file info banner */}
      {rawEsphomeYaml && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', backgroundColor: '#1a2e1a',
          borderBottom: '1px solid #2d5a2d', fontSize: '12px'
        }}>
          <FileCode size={14} color='#4ec94e' />
          <span style={{ color: '#4ec94e' }}>
            Full ESPHome file loaded – editing LVGL section only. Use <strong>Export</strong> to download the complete reconstructed file.
          </span>
        </div>
      )}
      
      {/* Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#2c2c2c',
          borderBottom: '1px solid #444',
          minHeight: '40px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {parseError ? (
            <>
              <AlertCircle size={16} color="#f44336" />
              <span style={{ color: '#f44336', fontSize: '13px' }}>{parseError}</span>
            </>
          ) : hasUnsavedChanges ? (
            <>
              <AlertCircle size={16} color="#ff9800" />
              <span style={{ color: '#ff9800', fontSize: '13px' }}>Unsaved changes</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} color="#4caf50" />
              <span style={{ color: '#4caf50', fontSize: '13px' }}>Valid YAML</span>
            </>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasUnsavedChanges && (
            <>
              <button
                onClick={handleRevert}
                style={{
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Revert
              </button>
              <button
                onClick={handleApplyChanges}
                disabled={!!parseError}
                style={{
                  backgroundColor: parseError ? '#555' : '#61dafb',
                  color: parseError ? '#888' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: parseError ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={14} />
                Apply (Ctrl+S)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="yaml"
          theme="vs-dark"
          value={editorValue}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            insertSpaces: true,
            formatOnPaste: true,
            formatOnType: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true
          }}
        />
      </div>
    </div>
  );
};
