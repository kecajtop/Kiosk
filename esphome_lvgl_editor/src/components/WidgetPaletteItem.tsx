import React from 'react';
import { useDrag } from 'react-dnd';
import { WidgetConfig } from '../types/widgets';
import * as Icons from 'lucide-react';

interface WidgetPaletteItemProps {
  config: WidgetConfig;
}

export const WidgetPaletteItem: React.FC<WidgetPaletteItemProps> = ({ config }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'widget',
    item: { config },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }));

  const IconComponent = Icons[config.icon as keyof typeof Icons] as React.FC<any>;
  const FallbackIcon = Icons.Shapes;

  return (
    <div
      ref={drag}
      className="widget-palette-item"
      style={{
        opacity: isDragging ? 0.5 : 1,
        padding: '12px 10px 10px',
        margin: '4px',
        background: 'linear-gradient(180deg, #2f3136 0%, #24262b 100%)',
        border: '1px solid #3d4148',
        borderRadius: '10px',
        cursor: 'move',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        boxShadow: isDragging ? 'none' : '0 6px 18px rgba(0,0,0,0.18)',
        minHeight: '78px',
        justifyContent: 'center'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = '#5b7486';
        e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.28)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#3d4148';
        e.currentTarget.style.boxShadow = isDragging ? 'none' : '0 6px 18px rgba(0,0,0,0.18)';
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 30% 30%, #203849 0%, #14212a 100%)',
          border: '1px solid rgba(116, 184, 227, 0.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        {IconComponent ? <IconComponent size={20} color="#9ad7ff" strokeWidth={2.2} /> : <FallbackIcon size={20} color="#9ad7ff" strokeWidth={2.2} />}
      </div>
      <span style={{ fontSize: '12px', color: '#d5d9df', fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
        {config.label}
      </span>
    </div>
  );
};
