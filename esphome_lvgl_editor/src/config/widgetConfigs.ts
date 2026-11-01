import { WidgetConfig } from '../types/widgets';

export const WIDGET_CONFIGS: WidgetConfig[] = [
  {
    type: 'label',
    label: 'Label',
    icon: 'Type',
    defaultProps: {
      text: 'Label Text',
      width: 100,
      height: 30,
      text_color: { r: 255, g: 255, b: 255 }
    }
  },
  {
    type: 'button',
    label: 'Button',
    icon: 'MousePointerClick',
    defaultProps: {
      width: 100,
      height: 50,
      bg_color: { r: 33, g: 150, b: 243 }
    }
  },
  {
    type: 'slider',
    label: 'Slider',
    icon: 'SlidersHorizontal',
    defaultProps: {
      width: 200,
      height: 20,
      min_value: 0,
      max_value: 100,
      value: 50
    }
  },
  {
    type: 'switch',
    label: 'Switch',
    icon: 'ToggleLeft',
    defaultProps: {
      width: 60,
      height: 30,
      checked: false
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'BadgeCheck',
    defaultProps: {
      width: 30,
      height: 30,
      checked: false
    }
  },
  {
    type: 'arc',
    label: 'Arc',
    icon: 'CircleDashed',
    defaultProps: {
      width: 100,
      height: 100,
      min_value: 0,
      max_value: 100,
      value: 50,
      start_angle: 135,
      end_angle: 45
    }
  },
  {
    type: 'bar',
    label: 'Bar',
    icon: 'ChartNoAxesColumnIncreasing',
    defaultProps: {
      width: 200,
      height: 30,
      min_value: 0,
      max_value: 100,
      value: 50
    }
  },
  {
    type: 'spinner',
    label: 'Spinner',
    icon: 'LoaderCircle',
    defaultProps: {
      width: 50,
      height: 50,
      arc_length: 60,
      spin_time: 1000
    }
  },
  {
    type: 'led',
    label: 'LED',
    icon: 'CircleDot',
    defaultProps: {
      width: 28,
      height: 28,
      color: { r: 80, g: 255, b: 120 },
      brightness: 255
    }
  },
  {
    type: 'line',
    label: 'Line',
    icon: 'Slash',
    defaultProps: {
      width: 100,
      height: 3,
      points: [[0, 0], [100, 0]],
      line_width: 2,
      line_color: { r: 255, g: 255, b: 255 }
    }
  },
  {
    type: 'obj',
    label: 'Container',
    icon: 'Container',
    defaultProps: {
      width: 200,
      height: 150,
      bg_color: { r: 44, g: 44, b: 44 },
      border_width: 1,
      border_color: { r: 85, g: 85, b: 85 }
    }
  },
  {
    type: 'image',
    label: 'Image',
    icon: 'Image',
    defaultProps: {
      width: 100,
      height: 100
    }
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: 'TextCursorInput',
    defaultProps: {
      width: 200,
      height: 100,
      text: '',
      placeholder: 'Enter text...'
    }
  },
  {
    type: 'spinbox',
    label: 'Spinbox',
    icon: 'BetweenHorizontalStart',
    defaultProps: {
      width: 110,
      height: 36,
      value: 0,
      range_from: 0,
      range_to: 999,
      step: 1,
      digit_count: 3,
      decimal_places: 0
    }
  },
  {
    type: 'msgbox',
    label: 'Message Box',
    icon: 'MessageSquareMore',
    defaultProps: {
      width: 180,
      height: 120,
      title: 'Messagebox',
      text: 'This is a sample messagebox.',
      close_button: true,
      buttons: ['Apply', 'Close']
    }
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    icon: 'ChevronsUpDown',
    defaultProps: {
      width: 150,
      height: 40,
      options: ['Option 1', 'Option 2', 'Option 3'],
      selected: 0
    }
  },
  {
    type: 'roller',
    label: 'Roller',
    icon: 'ListOrdered',
    defaultProps: {
      width: 100,
      height: 120,
      options: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
      visible_row_count: 3,
      selected: 0
    }
  },
  {
    type: 'buttonmatrix',
    label: 'Button Matrix',
    icon: 'LayoutGrid',
    defaultProps: {
      width: 320,
      height: 60,
      rows: [
        {
          buttons: [
            { text: 'Btn 1', width: 1 },
            { text: 'Btn 2', width: 1 },
            { text: 'Btn 3', width: 1 }
          ]
        }
      ]
    }
  }
];

// Default display dimensions (common ESP32 display sizes)
export const DISPLAY_PRESETS = {
  'ESP32-2432S028': { width: 320, height: 240 },
  'ESP32-3248S035': { width: 480, height: 320 },
  'Custom': { width: 320, height: 240 }
};
