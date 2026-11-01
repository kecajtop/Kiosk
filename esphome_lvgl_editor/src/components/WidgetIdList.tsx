import React, { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Search, Tag } from 'lucide-react';

export const WidgetIdList: React.FC = () => {
  const { getCurrentPage, selectWidget, selectedWidgetId } = useEditorStore();
  const [searchTerm, setSearchTerm] = useState('');
  const currentPage = getCurrentPage();
  
  const widgets = currentPage?.widgets || [];
  const filteredWidgets = widgets.filter(w => 
    (w.id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    w.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      style={{
        width: '250px',
        backgroundColor: '#1e1e1e',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#2c2c2c',
          borderBottom: '1px solid #444',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <Tag size={16} color="#61dafb" />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>
          Widget IDs
        </h3>
      </div>

      <div style={{ padding: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888'
            }}
          />
          <input
            type="text"
            placeholder="Search IDs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              backgroundColor: '#2c2c2c',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredWidgets.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#888',
              fontSize: '13px'
            }}
          >
            {widgets.length === 0 ? 'No widgets yet' : 'No matches found'}
          </div>
        ) : (
          <div style={{ padding: '0 8px' }}>
            {filteredWidgets.map((widget) => (
              <div
                key={widget.id || `widget-${Math.random()}`}
                onClick={() => selectWidget(widget.id || '')}
                style={{
                  padding: '10px 12px',
                  margin: '4px 0',
                  backgroundColor: selectedWidgetId === widget.id ? '#61dafb20' : '#2c2c2c',
                  border: `1px solid ${selectedWidgetId === widget.id ? '#61dafb' : '#444'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedWidgetId !== widget.id) {
                    e.currentTarget.style.backgroundColor = '#333';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedWidgetId !== widget.id) {
                    e.currentTarget.style.backgroundColor = '#2c2c2c';
                  }
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#61dafb',
                    marginBottom: '4px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}
                >
                  {widget.id}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#aaa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{widget.type}</span>
                  <span style={{ color: '#666' }}>
                    {widget.x}, {widget.y}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px',
          backgroundColor: '#2c2c2c',
          borderTop: '1px solid #444',
          fontSize: '12px',
          color: '#888',
          textAlign: 'center'
        }}
      >
        {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
