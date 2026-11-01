// Utility functions for LVGL color handling

export const parseHexColor = (hexValue: string | number | undefined): string => {
  if (!hexValue) return '#000000';
  
  // Convert to string and remove any 0x prefix
  let hexString = typeof hexValue === 'number' 
    ? hexValue.toString(16).padStart(6, '0')
    : hexValue.toString().replace('0x', '');
  
  // Pad with zeros if needed
  hexString = hexString.padStart(6, '0');
  
  return `#${hexString}`;
};

export const colorToRgb = (color: { r: number; g: number; b: number } | undefined): string => {
  if (!color) return 'rgb(0, 0, 0)';
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
};

// Convert hex color to RGB object
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Darken a color by a percentage (for gradients)
export const darkenColor = (rgb: { r: number; g: number; b: number }, percent: number): string => {
  const r = Math.max(0, Math.floor(rgb.r * (1 - percent)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - percent)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - percent)));
  return `rgb(${r}, ${g}, ${b})`;
};

// Lighten a color by a percentage
export const lightenColor = (rgb: { r: number; g: number; b: number }, percent: number): string => {
  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));
  return `rgb(${r}, ${g}, ${b})`;
};

// Get LVGL opacity value (0-255 to 0-1)
export const parseOpacity = (opa: string | number | undefined): number => {
  if (!opa) return 1;
  
  // Handle named opacity values
  if (typeof opa === 'string') {
    switch (opa.toUpperCase()) {
      case 'TRANSP': return 0;
      case 'COVER': return 1;
      case 'OPA_10': return 0.1;
      case 'OPA_20': return 0.2;
      case 'OPA_30': return 0.3;
      case 'OPA_40': return 0.4;
      case 'OPA_50': return 0.5;
      case 'OPA_60': return 0.6;
      case 'OPA_70': return 0.7;
      case 'OPA_80': return 0.8;
      case 'OPA_90': return 0.9;
      default: return 1;
    }
  }
  
  // Handle numeric values (0-255)
  if (typeof opa === 'number') {
    return Math.min(1, Math.max(0, opa / 255));
  }
  
  return 1;
};
