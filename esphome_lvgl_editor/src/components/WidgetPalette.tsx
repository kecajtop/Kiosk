import React from 'react';
import { WIDGET_CONFIGS } from '../config/widgetConfigs';
import { WidgetPaletteItem } from './WidgetPaletteItem';

export const WidgetPalette: React.FC = () => {
  return (
    <div
      style={{
        width: '200px',
        backgroundColor: '#1e1e1e',
        padding: '16px',
        overflowY: 'auto',
        borderRight: '1px solid #333'
      }}
    >
      <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Widgets</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px'
        }}
      >
        {WIDGET_CONFIGS.map((config) => (
          <WidgetPaletteItem key={config.type} config={config} />
        ))}
      </div>
    </div>
  );
};
