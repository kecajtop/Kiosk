import React, { useState } from 'react';
import { Plus, X, Edit2, Check } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

export const PageSelector: React.FC = () => {
  const { config, currentPageId, setCurrentPage, addPage, deletePage, renamePage, selectWidget, editMode, setEditMode } = useEditorStore();
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAddPage = () => {
    const newPageId = `page_${config.pages.length + 1}`;
    addPage(newPageId);
    setCurrentPage(newPageId);
  };

  const handleDeletePage = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (config.pages.length <= 1) {
      alert('Cannot delete the last page');
      return;
    }
    if (confirm(`Delete page "${pageId}"?`)) {
      deletePage(pageId);
    }
  };

  const handleStartEdit = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPageId(pageId);
    setEditValue(pageId);
  };

  const handleFinishEdit = () => {
    if (editingPageId && editValue.trim() && editValue !== editingPageId) {
      renamePage(editingPageId, editValue.trim());
    }
    setEditingPageId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditingPageId(null);
      setEditValue('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '8px 12px',
      backgroundColor: '#1e1e1e',
      borderBottom: '1px solid #333',
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap'
    }}>
      <div style={{ display: 'flex', gap: '4px', marginRight: '12px', flexShrink: 0 }}>
        <button
          onClick={() => { setEditMode('pages'); selectWidget(null); }}
          style={{
            padding: '6px 12px',
            backgroundColor: editMode === 'pages' ? '#007acc' : '#252526',
            border: '1px solid ' + (editMode === 'pages' ? '#007acc' : '#3c3c3c'),
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            color: editMode === 'pages' ? '#fff' : '#ccc',
            transition: 'all 0.2s'
          }}
        >
          Pages
        </button>
        <button
          onClick={() => { setEditMode('top_layer'); selectWidget(null); }}
          style={{
            padding: '6px 12px',
            backgroundColor: editMode === 'top_layer' ? '#007acc' : '#252526',
            border: '1px solid ' + (editMode === 'top_layer' ? '#007acc' : '#3c3c3c'),
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            color: editMode === 'top_layer' ? '#fff' : '#ccc',
            transition: 'all 0.2s'
          }}
        >
          Top Layer
        </button>
      </div>
      
      {editMode === 'pages' && (
      <>
      <div style={{ fontSize: '12px', color: '#888', marginRight: '8px', flexShrink: 0 }}>
        Select:
      </div>
      
      {config.pages.map((page) => (
        <div
          key={page.id}
          onClick={() => setCurrentPage(page.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: currentPageId === page.id ? '#2d2d30' : '#252526',
            border: currentPageId === page.id ? '1px solid #007acc' : '1px solid #3c3c3c',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            color: currentPageId === page.id ? '#fff' : '#ccc',
            transition: 'all 0.2s',
            flexShrink: 0,
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (currentPageId !== page.id) {
              e.currentTarget.style.backgroundColor = '#2d2d30';
              e.currentTarget.style.borderColor = '#555';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPageId !== page.id) {
              e.currentTarget.style.backgroundColor = '#252526';
              e.currentTarget.style.borderColor = '#3c3c3c';
            }
          }}
        >
          {editingPageId === page.id ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={handleKeyDown}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1e1e1e',
                border: '1px solid #007acc',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '2px',
                fontSize: '12px',
                outline: 'none',
                minWidth: '100px'
              }}
            />
          ) : (
            <>
              <span>{page.id}</span>
              <span style={{
                fontSize: '10px',
                color: '#888',
                backgroundColor: '#1e1e1e',
                padding: '2px 6px',
                borderRadius: '3px'
              }}>
                {page.widgets.length}
              </span>
            </>
          )}
          
          <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
            {editingPageId === page.id ? (
              <Check
                size={14}
                onClick={handleFinishEdit}
                style={{ cursor: 'pointer', color: '#4caf50' }}
              />
            ) : (
              <Edit2
                size={14}
                onClick={(e) => handleStartEdit(page.id, e)}
                style={{ cursor: 'pointer', color: '#888' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
              />
            )}
            <X
              size={14}
              onClick={(e) => handleDeletePage(page.id, e)}
              style={{ cursor: 'pointer', color: '#888' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#f44336'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
            />
          </div>
        </div>
      ))}
      
      <button
        onClick={handleAddPage}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          color: '#ccc',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2d2d30';
          e.currentTarget.style.borderColor = '#007acc';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#252526';
          e.currentTarget.style.borderColor = '#3c3c3c';
          e.currentTarget.style.color = '#ccc';
        }}
      >
        <Plus size={14} />
        New Page
      </button>
      </>
      )}
      
      {editMode === 'top_layer' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#ccc'
        }}>
          <span style={{ color: '#888' }}>Top Layer Widgets:</span>
          <span style={{
            backgroundColor: '#007acc',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {config.top_layer?.widgets?.length || 0}
          </span>
          <span style={{ color: '#666', fontSize: '11px', marginLeft: '8px' }}>
            (Always visible across all pages)
          </span>
        </div>
      )}
    </div>
  );
};
