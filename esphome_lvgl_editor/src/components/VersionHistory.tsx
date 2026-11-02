import React, { useState } from 'react';
import { History, RotateCcw, Trash2, X, Bookmark } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { LVGLConfig } from '../types/widgets';

const countWidgets = (widgets: any[]): number =>
  widgets.reduce((sum, w) => sum + 1 + (w.widgets ? countWidgets(w.widgets) : 0), 0);

const summarize = (config: LVGLConfig): string => {
  const widgetCount = config.pages.reduce((sum, p) => sum + countWidgets(p.widgets), 0)
    + countWidgets(config.top_layer?.widgets || []);
  return `${widgetCount} widget${widgetCount !== 1 ? 's' : ''} across ${config.pages.length} page${config.pages.length !== 1 ? 's' : ''}`;
};

// Checkpoints kept independently of Ctrl+Z/Y undo: taken automatically at
// natural safe points (opening or saving a file) and on demand, kept across
// page reloads, so a bad edit is always recoverable even after the undo
// stack is gone (e.g. after a refresh).
export const VersionHistory: React.FC = () => {
  const { savedVersions, saveVersion, restoreVersion, deleteVersion } = useEditorStore();
  const [open, setOpen] = useState(false);

  const handleRestore = (id: string, label: string) => {
    if (window.confirm(
      `Restore "${label}"?\n\nThe dashboard currently on screen will be replaced. ` +
      '(Your undo history still has the current state if you change your mind — Ctrl+Z after restoring.)'
    )) {
      restoreVersion(id);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Browse and restore saved checkpoints of this dashboard"
        style={btnStyle}
      >
        <History size={16} />
        Versions{savedVersions.length > 0 ? ` (${savedVersions.length})` : ''}
      </button>

      {open && (
        <div style={overlayStyle} onClick={() => setOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Version History</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => saveVersion('Manual checkpoint')}
                  title="Save the current state as a new checkpoint"
                  style={{ ...btnStyle, padding: '6px 10px', fontSize: '13px' }}
                >
                  <Bookmark size={14} />
                  Save checkpoint
                </button>
                <button onClick={() => setOpen(false)} style={iconBtnStyle}><X size={18} /></button>
              </div>
            </div>

            <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>
              Checkpoints are saved automatically when you open or save a file, and kept across page reloads
              (last 10). Use these to recover if an edit leaves the dashboard broken.
            </p>

            <div style={{ overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {savedVersions.length === 0 && <p style={{ color: '#888' }}>No saved checkpoints yet.</p>}
              {[...savedVersions].reverse().map((v) => (
                <div key={v.id} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ddd', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.label}
                    </div>
                    <div style={{ color: '#888', fontSize: '11px' }}>
                      {new Date(v.timestamp).toLocaleString()} — {summarize(v.config)}
                    </div>
                  </div>
                  <button onClick={() => handleRestore(v.id, v.label)} title="Restore this checkpoint" style={iconBtnStyle}>
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={() => deleteVersion(v.id)} title="Delete this checkpoint" style={iconBtnStyle}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
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
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
};
const modalStyle: React.CSSProperties = {
  backgroundColor: '#2c2c2c', borderRadius: '8px', padding: '24px', width: '560px', maxWidth: '90vw',
  maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '12px'
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e1e1e', border: '1px solid #333',
  borderRadius: '4px', padding: '8px 10px'
};
