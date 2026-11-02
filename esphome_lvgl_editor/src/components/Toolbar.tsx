import React, { useState, useRef } from 'react';
import { Save, Upload, Download, Monitor, Code, Eye, FileJson, Clipboard, Undo, Redo, Layers, List, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { configToPagesYaml, parseFullESPHomeFile, reconstructFullESPHomeYaml } from '../utils/yamlConverter';
import { DISPLAY_PRESETS } from '../config/widgetConfigs';
import { EsphomeFileBrowser } from './EsphomeFileBrowser';
import { ValidationStatus } from './ValidationStatus';
import { VersionHistory } from './VersionHistory';

interface ToolbarProps {
  viewMode: 'visual' | 'code' | 'split';
  onViewModeChange: (mode: 'visual' | 'code' | 'split') => void;
  onShowStylesPanel?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ viewMode, onViewModeChange, onShowStylesPanel }) => {
  const { config, loadConfig, displaySize, previewScale, setDisplaySize, setPreviewScale, undo, redo, canUndo, canRedo, snapToGrid, setSnapToGrid, previewMode, setPreviewMode, showPageTree, setShowPageTree, rawEsphomeYaml, setRawEsphomeYaml, lastImportIssues, setLastImportIssues, setOpenEsphomePath, setOpenEsphomeOriginalContent, saveVersion } = useEditorStore();
  const [displayPreset, setDisplayPreset] = useState<keyof typeof DISPLAY_PRESETS>('ESP32-2432S028');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const pasteTextAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleExport = () => {
    let content: string;
    let filename: string;
    if (rawEsphomeYaml) {
      content = reconstructFullESPHomeYaml(rawEsphomeYaml, config);
      filename = 'esphome-device.yaml';
    } else {
      content = configToPagesYaml(config);
      filename = 'esphome-lvgl-config.yaml';
    }
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProject = () => {
    const projectData = {
      version: '1.0',
      config,
      displaySize,
      timestamp: new Date().toISOString()
    };
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lvgl-project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const projectData = JSON.parse(event.target?.result as string);
            if (projectData.config) {
              loadConfig(projectData.config);
              setOpenEsphomePath(null);
              setOpenEsphomeOriginalContent(null);
              saveVersion('Loaded project file');
              if (projectData.displaySize) {
                setDisplaySize(projectData.displaySize);
                setDisplayPreset('Custom');
              }
            }
          } catch (error) {
            alert('Error loading project file: ' + error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const applyYamlImport = (yamlCode: string) => {
    const result = parseFullESPHomeFile(yamlCode);
    loadConfig(result.lvglConfig);
    setRawEsphomeYaml(result.isFullFile ? yamlCode : null);
    setLastImportIssues(result.issues);
    setOpenEsphomePath(null);
    setOpenEsphomeOriginalContent(null);
    saveVersion(`Imported ${result.isFullFile ? 'full ESPHome file' : 'LVGL YAML'}`);
    if (result.issues.length > 0) setShowIssuesModal(true);
  };

  const handlePasteCode = () => {
    setShowPasteModal(true);
  };

  const handlePasteSubmit = () => {
    const yamlCode = pasteTextAreaRef.current?.value;
    if (yamlCode) {
      try {
        applyYamlImport(yamlCode);
        setShowPasteModal(false);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        alert('Error parsing YAML:\n\n' + errorMsg + '\n\nPlease check your YAML syntax.');
      }
    }
  };


  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const yamlText = event.target?.result as string;
            applyYamlImport(yamlText);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            alert('Error loading YAML file:\n\n' + errorMsg + '\n\nPlease check your YAML syntax.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDisplayPresetChange = (preset: keyof typeof DISPLAY_PRESETS) => {
    setDisplayPreset(preset);
    if (preset !== 'Custom') {
      setDisplaySize(DISPLAY_PRESETS[preset]);
    }
  };

  const handleCustomSize = () => {
    const width = prompt('Enter display width:', displaySize.width.toString());
    const height = prompt('Enter display height:', displaySize.height.toString());
    if (width && height) {
      setDisplaySize({
        width: parseInt(width),
        height: parseInt(height)
      });
      setDisplayPreset('Custom');
    }
  };

  return (
    <div
      style={{
        height: '60px',
        backgroundColor: '#2c2c2c',
        borderBottom: '1px solid #444',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '16px',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ color: '#61dafb', margin: 0, fontSize: '18px', fontWeight: 600 }}>
          ESPHome LVGL Editor
        </h1>
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        <button
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
          style={{
            backgroundColor: canUndo() ? '#444' : '#2a2a2a',
            color: canUndo() ? '#fff' : '#666',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: canUndo() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Undo size={16} />
        </button>
        
        <button
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Y)"
          style={{
            backgroundColor: canRedo() ? '#444' : '#2a2a2a',
            color: canRedo() ? '#fff' : '#666',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: canRedo() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Redo size={16} />
        </button>
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        <button
          onClick={handleLoadProject}
          style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <FileJson size={16} />
          Load Project
        </button>
        
        <button
          onClick={handleSaveProject}
          style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Save size={16} />
          Save Project
        </button>
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        <button
          onClick={handleImport}
          style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Upload size={16} />
          Import YAML
        </button>
        
        <button
          onClick={handleExport}
          style={{
            backgroundColor: rawEsphomeYaml ? '#2a4a2a' : '#444',
            color: rawEsphomeYaml ? '#4ec94e' : '#fff',
            border: rawEsphomeYaml ? '1px solid #3a6a3a' : 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
          title={rawEsphomeYaml ? 'Export full ESPHome file with updated LVGL section' : 'Export LVGL YAML'}
        >
          <Download size={16} />
          {rawEsphomeYaml ? 'Export Full File' : 'Export YAML'}
        </button>

        <EsphomeFileBrowser />
        <ValidationStatus />
        <VersionHistory />

        {lastImportIssues.length > 0 && (
          <button
            onClick={() => setShowIssuesModal(true)}
            title="Show compatibility issues from last import"
            style={{
              backgroundColor: '#3a2e1a',
              color: '#f0a500',
              border: '1px solid #604a1a',
              borderRadius: '4px',
              padding: '8px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '13px'
            }}
          >
            <AlertTriangle size={14} />
            {lastImportIssues.length} issue{lastImportIssues.length !== 1 ? 's' : ''}
          </button>
        )}
        
        <button
          onClick={handlePasteCode}
          style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Clipboard size={16} />
          Paste Code
        </button>
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        {onShowStylesPanel && (
          <button
            onClick={onShowStylesPanel}
            title="Manage Styles & Top Layer"
            style={{
              backgroundColor: '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            <Layers size={16} />
            Styles
          </button>
        )}
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          cursor: 'pointer',
          color: '#ccc',
          fontSize: '14px'
        }}>
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            style={{ 
              width: '16px', 
              height: '16px',
              cursor: 'pointer'
            }}
          />
          Snap to Grid
        </label>

        <button
          onClick={() => setPreviewMode(!previewMode)}
          style={{
            backgroundColor: previewMode ? '#007acc' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <Eye size={16} />
          {previewMode ? 'Exit Preview' : 'Preview'}
        </button>

        <button
          onClick={() => setShowPageTree(!showPageTree)}
          style={{
            backgroundColor: showPageTree ? '#007acc' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <List size={16} />
          {showPageTree ? 'Hide Pages' : 'Show Pages'}
        </button>
        
        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor size={16} color="#ccc" />
          <select
            value={displayPreset}
            onChange={(e) => handleDisplayPresetChange(e.target.value as keyof typeof DISPLAY_PRESETS)}
            style={{
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {Object.keys(DISPLAY_PRESETS).map((preset) => (
              <option key={preset} value={preset}>
                {preset} ({DISPLAY_PRESETS[preset as keyof typeof DISPLAY_PRESETS].width}x
                {DISPLAY_PRESETS[preset as keyof typeof DISPLAY_PRESETS].height})
              </option>
            ))}
          </select>
          {displayPreset === 'Custom' && (
            <button
              onClick={handleCustomSize}
              style={{
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Set Size
            </button>
          )}
        </div>

        <div style={{ height: '30px', width: '1px', backgroundColor: '#444' }} />

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#ccc',
          fontSize: '14px'
        }}>
          Scale
          <input
            type="range"
            min={100}
            max={200}
            step={10}
            value={previewScale}
            onChange={(e) => setPreviewScale(parseInt(e.target.value, 10))}
            style={{ width: '120px', cursor: 'pointer' }}
            title="Preview scale from 100% to 200%"
          />
          <span style={{ minWidth: '48px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {previewScale}%
          </span>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          backgroundColor: '#333',
          borderRadius: '6px',
          padding: '4px'
        }}
      >
        <button
          onClick={() => onViewModeChange('visual')}
          style={{
            backgroundColor: viewMode === 'visual' ? '#61dafb' : 'transparent',
            color: viewMode === 'visual' ? '#000' : '#ccc',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          <Eye size={16} />
          Visual
        </button>
        <button
          onClick={() => onViewModeChange('code')}
          style={{
            backgroundColor: viewMode === 'code' ? '#61dafb' : 'transparent',
            color: viewMode === 'code' ? '#000' : '#ccc',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          <Code size={16} />
          Code
        </button>
        <button
          onClick={() => onViewModeChange('split')}
          style={{
            backgroundColor: viewMode === 'split' ? '#61dafb' : 'transparent',
            color: viewMode === 'split' ? '#000' : '#ccc',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Split
        </button>
      </div>

      {/* Paste Code Modal */}
      {showPasteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowPasteModal(false)}
        >
          <div
            style={{
              backgroundColor: '#2c2c2c',
              borderRadius: '8px',
              padding: '24px',
              width: '600px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Paste LVGL YAML Code</h2>
            <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>
              Paste your ESPHome LVGL YAML configuration below
            </p>
            <textarea
              ref={pasteTextAreaRef}
              placeholder="pages:\n  - id: main_page\n    widgets:\n      - label:\n          id: my_label\n          text: 'Hello'\n          x: 10\n          y: 20"
              style={{
                flex: 1,
                minHeight: '300px',
                backgroundColor: '#1e1e1e',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                padding: '12px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPasteModal(false)}
                style={{
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                style={{
                  backgroundColor: '#61dafb',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Parse & Load
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incompatibility Issues Modal */}
      {showIssuesModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#1e1e1e', border: '1px solid #555', borderRadius: '8px',
            padding: '24px', width: '680px', maxWidth: '95vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} color='#f0a500' />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                  Compatibility Report
                </span>
              </div>
              {rawEsphomeYaml && (
                <span style={{ fontSize: '12px', color: '#4ec94e', background: '#1a3a1a', padding: '2px 10px', borderRadius: '12px' }}>
                  ✓ Full ESPHome file detected – export will reconstruct the complete YAML
                </span>
              )}
              <button onClick={() => setShowIssuesModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#888' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>
              The following features in the imported file are{' '}
              <strong style={{ color: '#fff' }}>preserved on export</strong> but cannot be edited visually:
            </p>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '50vh' }}>
              {lastImportIssues.map((issue, i) => {
                const color = issue.severity === 'error' ? '#ff6b6b' : issue.severity === 'warning' ? '#f0a500' : '#6cb6ff';
                const Icon = issue.severity === 'error' ? AlertCircle : issue.severity === 'warning' ? AlertTriangle : Info;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    background: '#2a2a2a', borderRadius: '6px', padding: '8px 12px',
                    borderLeft: `3px solid ${color}`
                  }}>
                    <Icon size={14} color={color} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {issue.category}
                      </span>
                      <span style={{ color: '#e0e0e0', fontSize: '13px' }}>{issue.message}</span>
                      {issue.detail && <span style={{ color: '#888', fontSize: '12px' }}>{issue.detail}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {rawEsphomeYaml && (
                <button
                  onClick={() => { setRawEsphomeYaml(null); setShowIssuesModal(false); }}
                  style={{ background: '#3a2a2a', color: '#ff9999', border: '1px solid #664444',
                    borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Discard non-LVGL sections
                </button>
              )}
              <button
                onClick={() => setShowIssuesModal(false)}
                style={{ background: '#61dafb', color: '#000', border: 'none',
                  borderRadius: '4px', padding: '7px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                OK, Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
