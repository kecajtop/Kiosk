import React, { useState } from 'react';
import { FolderOpen, Save, RefreshCw, X, FileCode } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { configToPagesYaml, parseFullESPHomeFile, reconstructFullESPHomeYaml, validateReconstruction } from '../utils/yamlConverter';

// Talks to the add-on's own backend (server/index.js), which reads/writes YAML
// files under the Home Assistant ESPHome config folder mapped into the container.
interface EsphomeFile {
  path: string;
  size: number;
  hasLvgl: boolean;
}

export const EsphomeFileBrowser: React.FC = () => {
  const {
    config, loadConfig, rawEsphomeYaml, setRawEsphomeYaml,
    setLastImportIssues, openEsphomePath, setOpenEsphomePath,
    openEsphomeOriginalContent, setOpenEsphomeOriginalContent
  } = useEditorStore();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<EsphomeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/esphome/files');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not list files');
      setFiles(data.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBrowser = () => {
    setOpen(true);
    loadFiles();
  };

  const handleOpenFile = async (file: EsphomeFile) => {
    try {
      const res = await fetch(`/api/esphome/file/${file.path}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read file');
      const result = parseFullESPHomeFile(data.content);
      loadConfig(result.lvglConfig);
      setRawEsphomeYaml(result.isFullFile ? data.content : null);
      setLastImportIssues(result.issues);
      setOpenEsphomePath(file.path);
      setOpenEsphomeOriginalContent(data.content);
      setOpen(false);
    } catch (e) {
      alert('Error opening ' + file.path + ':\n\n' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleSave = async () => {
    if (!openEsphomePath) return;
    setSaving(true);
    try {
      // Re-read the file first: something else (the ESPHome add-on's own
      // editor, a text editor over SSH, …) may have changed it since it was
      // opened here. Never blind-overwrite someone else's edit.
      const current = await fetch(`/api/esphome/file/${openEsphomePath}`);
      const currentData = await current.json();
      if (!current.ok) throw new Error(currentData.error || 'Could not re-read file before saving');
      if (currentData.content !== openEsphomeOriginalContent) {
        alert(
          `"${openEsphomePath}" was changed on disk since you opened it here (maybe by the ESPHome add-on ` +
          'or another session). Saving now would overwrite that change, so the save was cancelled.\n\n' +
          'Re-open the file from "ESPHome Files" to see the latest version, then re-apply your edits.'
        );
        return;
      }

      const content = rawEsphomeYaml
        ? reconstructFullESPHomeYaml(rawEsphomeYaml, config)
        : configToPagesYaml(config);

      const validation = validateReconstruction(currentData.content, content);
      if (!validation.ok) {
        alert(
          `Refusing to save "${openEsphomePath}": ${validation.error}\n\n` +
          'The file on disk was not touched.'
        );
        return;
      }

      const res = await fetch(`/api/esphome/file/${openEsphomePath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: content
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (rawEsphomeYaml) setRawEsphomeYaml(content);
      setOpenEsphomeOriginalContent(content);
    } catch (e) {
      alert('Error saving ' + openEsphomePath + ':\n\n' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenBrowser}
        title="Browse and open ESPHome YAML files from this Home Assistant instance"
        style={btnStyle}
      >
        <FolderOpen size={16} />
        ESPHome Files
      </button>

      {openEsphomePath && (
        <button
          onClick={handleSave}
          disabled={saving}
          title={`Save back to ${openEsphomePath}`}
          style={{ ...btnStyle, backgroundColor: '#2a4a2a', color: '#4ec94e', border: '1px solid #3a6a3a' }}
        >
          <Save size={16} />
          {saving ? 'Saving…' : `Save ${openEsphomePath}`}
        </button>
      )}

      {open && (
        <div style={overlayStyle} onClick={() => setOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>ESPHome YAML Files</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={loadFiles} title="Refresh" style={iconBtnStyle}><RefreshCw size={16} /></button>
                <button onClick={() => setOpen(false)} style={iconBtnStyle}><X size={18} /></button>
              </div>
            </div>
            <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>
              Files found under the Home Assistant <code>esphome</code> config folder. Files marked{' '}
              <span style={{ color: '#4ec94e' }}>LVGL</span> contain an <code>lvgl:</code> section. Opening a
              file loads it into the visual editor for live preview and editing; use{' '}
              <strong>Save</strong> in the toolbar to write your changes back to that same file.
            </p>
            {loading && <p style={{ color: '#888' }}>Loading…</p>}
            {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
            {!loading && !error && (
              <div style={{ overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {files.length === 0 && <p style={{ color: '#888' }}>No .yaml files found.</p>}
                {files.map((f) => (
                  <button key={f.path} onClick={() => handleOpenFile(f)} style={fileRowStyle}>
                    <FileCode size={14} style={{ flexShrink: 0, color: f.hasLvgl ? '#4ec94e' : '#888' }} />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.path}
                    </span>
                    {f.hasLvgl && <span style={lvglBadgeStyle}>LVGL</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const btnStyle: React.CSSProperties = {
  backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '4px',
  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px'
};
const iconBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#888' };
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalStyle: React.CSSProperties = {
  backgroundColor: '#2c2c2c', borderRadius: '8px', padding: '24px', width: '560px', maxWidth: '90vw',
  maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '12px'
};
const fileRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e1e1e', border: '1px solid #333',
  borderRadius: '4px', padding: '8px 10px', color: '#ddd', cursor: 'pointer', fontSize: '13px', fontFamily: 'monospace'
};
const lvglBadgeStyle: React.CSSProperties = {
  fontSize: '10px', color: '#4ec94e', background: '#1a3a1a', padding: '2px 6px', borderRadius: '10px', flexShrink: 0
};
