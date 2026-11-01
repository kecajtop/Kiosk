import React, { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Widget } from '../types/widgets';
import { Trash2, Plus } from 'lucide-react';
import { WidgetTree } from './WidgetTree';
import { WIDGET_CONFIGS } from '../config/widgetConfigs';

export const PropertiesPanel: React.FC = () => {
  const [showAddWidgetMenu, setShowAddWidgetMenu] = useState(false);
  const { 
    selectedWidgetId, 
    selectedWidgetPath,
    updateWidget, 
    deleteWidget, 
    getCurrentPage,
    selectWidgetByPath,
    addNestedWidget,
    updateNestedWidget,
    deleteNestedWidget,
    getWidgetByPath,
    config,
    updateTopLayerWidget,
    deleteTopLayerWidget
  } = useEditorStore();
  const currentPage = getCurrentPage();
  
  // Get widget either by direct selection or by path
  let selectedWidget: Widget | null = null;
  let isTopLayerWidget = false;
  
  if (selectedWidgetPath) {
    selectedWidget = getWidgetByPath(selectedWidgetPath);
  } else if (selectedWidgetId) {
    // Check if it's a page widget first
    selectedWidget = currentPage?.widgets.find(w => w.id === selectedWidgetId) || null;
    
    // If not found in page, check top_layer
    if (!selectedWidget && config.top_layer?.widgets) {
      selectedWidget = config.top_layer.widgets.find(w => w.id === selectedWidgetId) || null;
      isTopLayerWidget = !!selectedWidget;
    }
  }

  if (!selectedWidget) {
    return (
      <div
        style={{
          width: '300px',
          backgroundColor: '#1e1e1e',
          padding: '16px',
          borderLeft: '1px solid #333',
          color: '#ccc',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ color: '#fff', marginBottom: '16px' }}>Properties</h3>
        <p style={{ fontSize: '14px' }}>Select a widget to edit its properties</p>
      </div>
    );
  }

  const handleChange = (key: keyof Widget, value: any) => {
    if (selectedWidgetPath) {
      updateNestedWidget(selectedWidgetPath, { [key]: value });
    } else if (selectedWidget?.id) {
      const updateFn = isTopLayerWidget ? updateTopLayerWidget : updateWidget;
      updateFn(selectedWidget.id, { [key]: value });
    }
  };

  const handleColorChange = (key: string, channel: 'r' | 'g' | 'b', value: string) => {
    const currentColor = (selectedWidget as any)[key] || { r: 0, g: 0, b: 0 };
    handleChange(key as keyof Widget, {
      ...currentColor,
      [channel]: parseInt(value) || 0
    });
  };

  const handleDelete = () => {
    if (confirm('Delete this widget?')) {
      if (selectedWidgetPath) {
        deleteNestedWidget(selectedWidgetPath);
      } else if (selectedWidget?.id) {
        const deleteFn = isTopLayerWidget ? deleteTopLayerWidget : deleteWidget;
        deleteFn(selectedWidget.id);
      }
    }
  };

  const renderPropertyInput = (label: string, key: string, type: 'text' | 'number' | 'checkbox' = 'text') => {
    const value = (selectedWidget as any)[key];
    
    if (type === 'checkbox') {
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => handleChange(key as keyof Widget, e.target.checked)}
              style={{ width: '14px', height: '14px' }}
            />
            {label}
          </label>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', marginBottom: '3px', fontSize: '11px', color: '#aaa' }}>
          {label}
        </label>
        <input
          type={type}
          value={value as string | number || ''}
          onChange={(e) => handleChange(key as keyof Widget, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid #444',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '13px'
          }}
        />
      </div>
    );
  };

  const renderFieldGroup = (fields: Array<{label: string, key: string, type?: 'text' | 'number'}>) => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${fields.length}, 1fr)`, gap: '6px', marginBottom: '8px' }}>
        {fields.map(field => {
          const value = (selectedWidget as any)[field.key];
          return (
            <div key={field.key}>
              <label style={{ display: 'block', marginBottom: '3px', fontSize: '11px', color: '#aaa' }}>
                {field.label}
              </label>
              <input
                type={field.type || 'number'}
                value={value || ''}
                onChange={(e) => handleChange(field.key as keyof Widget, field.type === 'text' ? e.target.value : parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid #444',
                  borderRadius: '3px',
                  color: '#fff',
                  fontSize: '13px'
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderSelectInput = (label: string, key: string, options: string[], resetPositionOnChange: boolean = false) => {
    const value = (selectedWidget as any)[key] as string || '';
    
    return (
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', marginBottom: '3px', fontSize: '11px', color: '#aaa' }}>
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => {
            const newValue = e.target.value || undefined;
            if (resetPositionOnChange && key === 'align') {
              // When changing alignment, reset x and y to 0,0
              if (selectedWidgetPath) {
                updateNestedWidget(selectedWidgetPath, { [key]: newValue, x: 0, y: 0 });
              } else if (selectedWidget?.id) {
                const updateFn = isTopLayerWidget ? updateTopLayerWidget : updateWidget;
                updateFn(selectedWidget.id, { [key]: newValue, x: 0, y: 0 });
              }
            } else {
              handleChange(key as keyof Widget, newValue);
            }
          }}
          style={{
            width: '100%',
            padding: '4px 6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid #444',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="">None</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderColorInput = (label: string, key: string) => {
    const color = (selectedWidget as any)[key] || { r: 255, g: 255, b: 255 };
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['r', 'g', 'b'] as const).map((channel) => (
            <div key={channel} style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                max="255"
                value={color[channel]}
                onChange={(e) => handleColorChange(key, channel, e.target.value)}
                placeholder={channel.toUpperCase()}
                style={{
                  width: '100%',
                  padding: '6px 4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  textAlign: 'center'
                }}
              />
            </div>
          ))}
          <div
            style={{
              width: '40px',
              height: '32px',
              backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
              border: '1px solid #444',
              borderRadius: '4px'
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '300px',
        backgroundColor: '#1e1e1e',
        padding: '16px',
        borderLeft: '1px solid #333',
        color: '#ccc',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0 }}>Properties</h3>
          {isTopLayerWidget && (
            <span style={{ fontSize: '11px', color: '#61dafb', marginTop: '4px', display: 'block' }}>
              Top Layer Widget
            </span>
          )}
        </div>
        <button
          onClick={handleDelete}
          style={{
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#2c2c2c', borderRadius: '4px' }}>
        <div style={{ fontSize: '12px', color: '#aaa' }}>Type</div>
        <div style={{ fontSize: '14px', color: '#61dafb', marginTop: '4px' }}>{selectedWidget.type}</div>
      </div>

      {renderPropertyInput('ID', 'id', 'text')}

      {/* Line widgets don't use position/size - they use points */}
      {selectedWidget.type !== 'line' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Position & Size</h4>
          {renderFieldGroup([{label: 'X', key: 'x'}, {label: 'Y', key: 'y'}])}
          {renderFieldGroup([{label: 'Width', key: 'width'}, {label: 'Height', key: 'height'}])}
          {renderSelectInput('Align', 'align', [
            'CENTER',
            'TOP_LEFT',
            'TOP_MID',
            'TOP_RIGHT',
            'BOTTOM_LEFT',
            'BOTTOM_MID',
            'BOTTOM_RIGHT',
            'LEFT_MID',
            'RIGHT_MID',
            'OUT_TOP_LEFT',
            'OUT_TOP_MID',
            'OUT_TOP_RIGHT',
            'OUT_BOTTOM_LEFT',
            'OUT_BOTTOM_MID',
            'OUT_BOTTOM_RIGHT',
            'OUT_LEFT_TOP',
            'OUT_LEFT_MID',
            'OUT_LEFT_BOTTOM',
            'OUT_RIGHT_TOP',
            'OUT_RIGHT_MID',
            'OUT_RIGHT_BOTTOM'
          ], true)}

          {renderSelectInput('Layout', 'layout', [
            '', 'FLEX', 'GRID'
          ])}
        </>
      )}
      
      {(selectedWidget as any).layout === 'FLEX' && (
        <>
          {renderSelectInput('Flex Flow', 'flex_flow', [
            'ROW', 'COLUMN', 'ROW_WRAP', 'COLUMN_WRAP', 'ROW_REVERSE', 'COLUMN_REVERSE'
          ])}
          {renderSelectInput('Flex Align', 'flex_align', [
            'START', 'CENTER', 'END', 'SPACE_BETWEEN', 'SPACE_AROUND', 'SPACE_EVENLY'
          ])}
        </>
      )}

      <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Style</h4>
      {renderPropertyInput('Style Reference', 'styles', 'text')}
      {renderColorInput('Background Color', 'bg_color')}
      {renderPropertyInput('Border Width', 'border_width', 'number')}
      {renderColorInput('Border Color', 'border_color')}
      {renderPropertyInput('Border Radius', 'radius', 'number')}
      {renderPropertyInput('Opacity (0-255)', 'opacity', 'number')}
      {renderPropertyInput('Hidden', 'hidden', 'checkbox')}

      {/* Type-specific properties */}
      {selectedWidget.type === 'label' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Label Properties</h4>
          {renderPropertyInput('Text', 'text', 'text')}
          {renderColorInput('Text Color', 'text_color')}
          {renderPropertyInput('Text Font', 'text_font', 'text')}
          {renderSelectInput('Text Align', 'text_align', [
            'LEFT',
            'CENTER',
            'RIGHT',
            'AUTO'
          ])}
        </>
      )}

      {(selectedWidget.type === 'slider' || selectedWidget.type === 'bar' || selectedWidget.type === 'arc') && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Value Properties</h4>
          {renderFieldGroup([{label: 'Min', key: 'min_value'}, {label: 'Max', key: 'max_value'}, {label: 'Value', key: 'value'}])}
        </>
      )}

      {(selectedWidget.type === 'switch' || selectedWidget.type === 'checkbox') && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>State</h4>
          {renderPropertyInput('Checked', 'checked', 'checkbox')}
        </>
      )}

      {selectedWidget.type === 'led' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>LED Properties</h4>
          {renderColorInput('LED Color', 'color')}
          {renderPropertyInput('Brightness (0-255)', 'brightness', 'number')}
        </>
      )}

      {selectedWidget.type === 'checkbox' && (
        <>
          {renderPropertyInput('Text', 'text', 'text')}
        </>
      )}

      {selectedWidget.type === 'spinbox' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Spinbox Properties</h4>
          {renderFieldGroup([{label: 'From', key: 'range_from'}, {label: 'To', key: 'range_to'}, {label: 'Value', key: 'value'}])}
          {renderFieldGroup([{label: 'Step', key: 'step'}, {label: 'Digits', key: 'digit_count'}, {label: 'Decimals', key: 'decimal_places'}])}
          {renderPropertyInput('Rollover', 'rollover', 'checkbox')}
        </>
      )}

      {selectedWidget.type === 'msgbox' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Message Box Properties</h4>
          {renderPropertyInput('Title', 'title', 'text')}
          {renderPropertyInput('Text', 'text', 'text')}
          {renderPropertyInput('Close Button', 'close_button', 'checkbox')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>
              Buttons (comma-separated)
            </label>
            <input
              type="text"
              value={(selectedWidget as any).buttons?.join(', ') || ''}
              onChange={(e) => handleChange('buttons' as keyof Widget, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>
        </>
      )}

      {(selectedWidget.type === 'dropdown' || selectedWidget.type === 'roller') && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Options</h4>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>
              Options (comma-separated)
            </label>
            <input
              type="text"
              value={(selectedWidget as any).options?.join(', ') || ''}
              onChange={(e) => handleChange('options' as keyof Widget, e.target.value.split(',').map(s => s.trim()))}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>
          {renderPropertyInput('Selected Index', 'selected', 'number')}
        </>
      )}

      {selectedWidget.type === 'textarea' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Text Area Properties</h4>
          {renderPropertyInput('Text', 'text', 'text')}
          {renderPropertyInput('Placeholder', 'placeholder', 'text')}
          {renderPropertyInput('One Line', 'one_line', 'checkbox')}
          {renderPropertyInput('Password Mode', 'password_mode', 'checkbox')}
          {renderPropertyInput('Max Length', 'max_length', 'number')}
        </>
      )}

      {selectedWidget.type === 'spinner' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Spinner Properties</h4>
          {renderPropertyInput('Arc Length', 'arc_length', 'number')}
          {renderPropertyInput('Spin Time (ms)', 'spin_time', 'number')}
        </>
      )}

      {selectedWidget.type === 'buttonmatrix' && (() => {
        const bmWidget = selectedWidget as any;
        const rows: Array<{ buttons: Array<any> }> = bmWidget.rows || [];
        const allPages = config.pages || [];
        const inputStyle: React.CSSProperties = {
          width: '100%', padding: '3px 5px',
          backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #444',
          borderRadius: '3px', color: '#fff', fontSize: '12px'
        };
        const smallBtnStyle: React.CSSProperties = {
          background: 'none', border: '1px solid #555', borderRadius: '3px',
          color: '#aaa', cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
          lineHeight: '1.4'
        };

        const updateRows = (newRows: typeof rows) => handleChange('rows' as keyof Widget, newRows);

        const addRow = () => updateRows([...rows, { buttons: [{ text: 'BTN' }] }]);

        const deleteRow = (ri: number) => updateRows(rows.filter((_, i) => i !== ri));

        const addButton = (ri: number) =>
          updateRows(rows.map((row, i) => i === ri
            ? { ...row, buttons: [...(row.buttons || []), { text: 'BTN' }] } : row));

        const deleteButton = (ri: number, bi: number) =>
          updateRows(rows.map((row, i) => i === ri
            ? { ...row, buttons: row.buttons.filter((_, j) => j !== bi) } : row));

        const updateButton = (ri: number, bi: number, updates: any) =>
          updateRows(rows.map((row, i) => i === ri
            ? { ...row, buttons: row.buttons.map((btn, j) => j === bi ? { ...btn, ...updates } : btn) } : row));

        const getActionType = (btn: any): string => {
          const then = btn?.on_press?.then;
          if (!then) return 'none';
          if ('lvgl.page.previous' in then) return 'prev';
          if ('lvgl.page.next' in then) return 'next';
          if ('lvgl.page.show' in then) return 'show:' + (then['lvgl.page.show'] || '');
          return 'none';
        };

        const setAction = (ri: number, bi: number, value: string) => {
          let on_press: any = undefined;
          if (value === 'prev')  on_press = { then: { 'lvgl.page.previous': null } };
          else if (value === 'next') on_press = { then: { 'lvgl.page.next': null } };
          else if (value.startsWith('show:')) on_press = { then: { 'lvgl.page.show': value.slice(5) } };
          updateRows(rows.map((row, i) => i === ri
            ? { ...row, buttons: row.buttons.map((btn, j) => {
                if (j !== bi) return btn;
                const next = { ...btn };
                if (on_press === undefined) delete next.on_press;
                else next.on_press = on_press;
                return next;
              }) } : row));
        };

        const sectionHeader = (label: string) => (
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '6px', fontSize: '13px' }}>{label}</h4>
        );

        return (
          <>
            {sectionHeader('Button Matrix')}

            {/* Items style */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', marginBottom: '3px', fontSize: '11px', color: '#aaa' }}>
                Items Style Reference
              </label>
              <input
                type="text"
                value={bmWidget.items?.styles || ''}
                onChange={e => handleChange('items' as keyof Widget, { ...(bmWidget.items || {}), styles: e.target.value || undefined })}
                style={inputStyle}
              />
            </div>

            {renderPropertyInput('Text Font', 'text_font', 'text')}
            {renderPropertyInput('One Checked', 'one_checked', 'checkbox')}

            {sectionHeader(`Rows (${rows.length})`)}

            {rows.map((row, ri) => (
              <div key={ri} style={{
                marginBottom: '10px', border: '1px solid #3a3a3a',
                borderRadius: '5px', overflow: 'hidden'
              }}>
                {/* Row header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px', backgroundColor: '#2a2a2a'
                }}>
                  <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>
                    ROW {ri + 1}
                  </span>
                  <button onClick={() => deleteRow(ri)} style={{ ...smallBtnStyle, color: '#e07070' }}>
                    Remove row
                  </button>
                </div>

                {/* Buttons in this row */}
                {(row.buttons || []).map((btn: any, bi: number) => (
                  <div key={bi} style={{
                    padding: '6px 8px', borderTop: '1px solid #333',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#61dafb' }}>Button {bi + 1}</span>
                      <button onClick={() => deleteButton(ri, bi)} style={{ ...smallBtnStyle, color: '#e07070', fontSize: '12px', padding: '0 5px' }}>
                        ×
                      </button>
                    </div>

                    {/* Text */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Text</label>
                        <input
                          type="text"
                          value={btn.text ?? ''}
                          onChange={e => updateButton(ri, bi, { text: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>ID</label>
                        <input
                          type="text"
                          value={btn.id ?? ''}
                          onChange={e => updateButton(ri, bi, { id: e.target.value || undefined })}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    {/* Width */}
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>
                        Width (relative, default 1)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={btn.width ?? 1}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          updateButton(ri, bi, { width: isNaN(v) || v <= 1 ? undefined : v });
                        }}
                        style={{ ...inputStyle, width: '80px' }}
                      />
                    </div>

                    {/* Action */}
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>
                        on_press Action
                      </label>
                      <select
                        value={getActionType(btn)}
                        onChange={e => setAction(ri, bi, e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value="none">— None —</option>
                        <option value="prev">← lvgl.page.previous</option>
                        <option value="next">→ lvgl.page.next</option>
                        {allPages.map(p => (
                          <option key={p.id} value={'show:' + p.id}>
                            Show page: {p.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {/* Add button */}
                <div style={{ padding: '5px 8px', borderTop: (row.buttons?.length || 0) > 0 ? '1px solid #333' : 'none' }}>
                  <button
                    onClick={() => addButton(ri)}
                    style={{ ...smallBtnStyle, color: '#61dafb', width: '100%', textAlign: 'center' }}
                  >
                    + Add Button
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addRow}
              style={{
                width: '100%', padding: '6px', marginBottom: '8px',
                backgroundColor: '#1a3a1a', border: '1px solid #3a6a3a',
                borderRadius: '4px', color: '#4ec94e', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600
              }}
            >
              + Add Row
            </button>
          </>
        );
      })()}

      {selectedWidget.type === 'image' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Image Properties</h4>
          {renderPropertyInput('Source', 'src', 'text')}
        </>
      )}

      {selectedWidget.type === 'line' && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Line Properties</h4>
          {renderPropertyInput('Line Width', 'line_width', 'number')}
          {renderColorInput('Line Color', 'line_color')}
          {renderPropertyInput('Dash Width', 'line_dash_width', 'number')}
          {renderPropertyInput('Dash Gap', 'line_dash_gap', 'number')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedWidget as any).line_rounded || false}
                onChange={(e) => handleChange('line_rounded' as keyof Widget, e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Rounded Endpoints
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>
              Points (x,y pairs)
            </label>
            <textarea
              value={(selectedWidget as any).points?.map((p: [number, number]) => `${p[0]}, ${p[1]}`).join('\n') || ''}
              onChange={(e) => {
                const points = e.target.value.split('\n').map(line => {
                  const [x, y] = line.split(',').map(s => parseFloat(s.trim()));
                  return [x || 0, y || 0] as [number, number];
                });
                handleChange('points' as keyof Widget, points);
              }}
              rows={4}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </>
      )}

      {(selectedWidget.type === 'obj' || (selectedWidget.type === 'button' && (selectedWidget as any).widgets)) && (
        <>
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px' }}>Container Properties</h4>
          {selectedWidget.type === 'obj' && (
            <>
              {renderFieldGroup([{label: 'Pad All', key: 'pad_all'}, {label: 'Pad Row', key: 'pad_row'}, {label: 'Pad Col', key: 'pad_column'}])}
            </>
          )}
          
          <h4 style={{ color: '#fff', marginTop: '12px', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Child Widgets
              <span style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>
                ({(selectedWidget as any).widgets?.length || 0})
              </span>
            </div>
            {selectedWidget.type === 'obj' && (
              <button
                onClick={() => setShowAddWidgetMenu(!showAddWidgetMenu)}
                style={{
                  backgroundColor: '#4a8aba',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
                title="Add child widget"
              >
                <Plus size={14} />
                Add
              </button>
            )}
          </h4>
          
          {showAddWidgetMenu && selectedWidget.type === 'obj' && (
            <div style={{
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: '#1a1a1a',
              borderRadius: '4px',
              border: '1px solid #444'
            }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Select widget type:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {WIDGET_CONFIGS.map(config => (
                  <button
                    key={config.type}
                    onClick={() => {
                      const page = getCurrentPage();
                      const widgetIndex = page?.widgets.findIndex(w => w.id === selectedWidget?.id);
                      if (widgetIndex !== undefined && widgetIndex !== -1) {
                        const newWidget: any = {
                          type: config.type,
                          x: 10,
                          y: 10,
                          ...config.defaultProps
                        };
                        addNestedWidget(`${widgetIndex}`, newWidget);
                      }
                      setShowAddWidgetMenu(false);
                    }}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div style={{
            padding: '8px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            minHeight: '100px',
            maxHeight: '500px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <WidgetTree
              widgets={(selectedWidget as any).widgets || []}
              selectedWidgetPath={selectedWidgetPath}
              onSelectWidget={(path) => {
                const page = getCurrentPage();
                const widgetIndex = page?.widgets.findIndex(w => w.id === selectedWidget?.id);
                if (widgetIndex !== undefined && widgetIndex !== -1) {
                  const fullPath = `${widgetIndex}.${path}`;
                  selectWidgetByPath(fullPath);
                }
              }}
              onAddWidget={(parentPath, widgetType) => {
                const config = WIDGET_CONFIGS.find(c => c.type === widgetType);
                if (!config) return;
                
                const page = getCurrentPage();
                const widgetIndex = page?.widgets.findIndex(w => w.id === selectedWidget?.id);
                if (widgetIndex === undefined || widgetIndex === -1) return;
                
                const fullParentPath = parentPath ? `${widgetIndex}.${parentPath}` : `${widgetIndex}`;
                
                const newWidget: any = {
                  type: config.type,
                  x: 10,
                  y: 10,
                  ...config.defaultProps
                };
                
                addNestedWidget(fullParentPath, newWidget);
              }}
              onDeleteWidget={(path) => {
                const page = getCurrentPage();
                const widgetIndex = page?.widgets.findIndex(w => w.id === selectedWidget?.id);
                if (widgetIndex !== undefined && widgetIndex !== -1) {
                  const fullPath = `${widgetIndex}.${path}`;
                  deleteNestedWidget(fullPath);
                }
              }}
              parentPath=""
            />
            {(!(selectedWidget as any).widgets || (selectedWidget as any).widgets.length === 0) && (
              <div style={{
                textAlign: 'center',
                color: '#666',
                fontSize: '12px',
                padding: '20px',
                marginTop: '8px'
              }}>
                No child widgets yet.<br/>
                {selectedWidget.type === 'obj' && 'Click + to add widgets to this container.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
