import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { StyleDefinition } from '../types/widgets';

export const StylesPanel: React.FC = () => {
  const { config, addStyle, updateStyle, deleteStyle } = useEditorStore();
  const [editingStyle, setEditingStyle] = useState<StyleDefinition | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleAddStyle = () => {
    const newStyle: StyleDefinition = {
      id: `style_${(config.style_definitions?.length || 0) + 1}`
    };
    setEditingStyle(newStyle);
    setShowEditor(true);
  };

  const handleEditStyle = (style: StyleDefinition) => {
    setEditingStyle({ ...style });
    setShowEditor(true);
  };

  const handleSaveStyle = () => {
    if (editingStyle) {
      const existing = config.style_definitions?.find(s => s.id === editingStyle.id);
      if (existing) {
        updateStyle(editingStyle.id, editingStyle);
      } else {
        addStyle(editingStyle);
      }
      setShowEditor(false);
      setEditingStyle(null);
    }
  };

  const handleDeleteStyle = (styleId: string) => {
    if (confirm(`Delete style "${styleId}"?`)) {
      deleteStyle(styleId);
    }
  };

  const styles = config.style_definitions || [];

  return (
    <div style={{
      width: '300px',
      backgroundColor: '#252526',
      borderRight: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Style Definitions</h3>
        <button
          onClick={handleAddStyle}
          style={{
            backgroundColor: '#007acc',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px'
          }}
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {styles.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#888',
            fontSize: '12px'
          }}>
            No styles defined
          </div>
        ) : (
          styles.map(style => (
            <div
              key={style.id}
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3c3c3c',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '8px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#61dafb' }}>
                  {style.id}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleEditStyle(style)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#888'
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteStyle(style.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#888'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>
                {style.text_color && <div>text_color: {JSON.stringify(style.text_color)}</div>}
                {style.text_font && <div>text_font: {style.text_font}</div>}
                {style.bg_color && <div>bg_color: {JSON.stringify(style.bg_color)}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {showEditor && editingStyle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#252526',
            border: '1px solid #444',
            borderRadius: '6px',
            width: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                {config.style_definitions?.find(s => s.id === editingStyle.id) ? 'Edit Style' : 'New Style'}
              </h3>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingStyle(null);
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                  ID
                </label>
                <input
                  type="text"
                  value={editingStyle.id}
                  onChange={(e) => setEditingStyle({ ...editingStyle, id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3c3c3c',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                  Text Font
                </label>
                <input
                  type="text"
                  value={editingStyle.text_font || ''}
                  onChange={(e) => setEditingStyle({ ...editingStyle, text_font: e.target.value || undefined })}
                  placeholder="my_font"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3c3c3c',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                  Text Color (hex)
                </label>
                <input
                  type="text"
                  value={editingStyle.text_color ? 
                    `#${editingStyle.text_color.r.toString(16).padStart(2, '0')}${editingStyle.text_color.g.toString(16).padStart(2, '0')}${editingStyle.text_color.b.toString(16).padStart(2, '0')}`
                    : ''}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    if (hex.length === 6) {
                      setEditingStyle({
                        ...editingStyle,
                        text_color: {
                          r: parseInt(hex.substring(0, 2), 16),
                          g: parseInt(hex.substring(2, 4), 16),
                          b: parseInt(hex.substring(4, 6), 16)
                        }
                      });
                    } else if (!hex) {
                      setEditingStyle({ ...editingStyle, text_color: undefined });
                    }
                  }}
                  placeholder="#FFFFFF"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3c3c3c',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
                  Background Color (hex)
                </label>
                <input
                  type="text"
                  value={editingStyle.bg_color ? 
                    `#${editingStyle.bg_color.r.toString(16).padStart(2, '0')}${editingStyle.bg_color.g.toString(16).padStart(2, '0')}${editingStyle.bg_color.b.toString(16).padStart(2, '0')}`
                    : ''}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    if (hex.length === 6) {
                      setEditingStyle({
                        ...editingStyle,
                        bg_color: {
                          r: parseInt(hex.substring(0, 2), 16),
                          g: parseInt(hex.substring(2, 4), 16),
                          b: parseInt(hex.substring(4, 6), 16)
                        }
                      });
                    } else if (!hex) {
                      setEditingStyle({ ...editingStyle, bg_color: undefined });
                    }
                  }}
                  placeholder="#000000"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3c3c3c',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderTop: '1px solid #333',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px'
            }}>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingStyle(null);
                }}
                style={{
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStyle}
                style={{
                  backgroundColor: '#007acc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
