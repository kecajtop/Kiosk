// Zamienia aktualne drzewo widgetów edytora (strona + style_definitions + fonts) na płaski
// JSON, który "silnik" wasm/interpreter.c potrafi zbudować jako prawdziwe obiekty LVGL.
//
// To NIE jest pełne odwzorowanie schematu `lvgl:` ESPHome — tylko właściwości i typy
// widgetów, które interpreter.c faktycznie obsługuje (patrz komentarz na górze tego pliku
// w wasm/interpreter.c). Widgety/właściwości spoza tej listy są pomijane po cichu (silently
// dropped) zamiast psuć cały podgląd — realny LVGL pokaże wtedy mniej niż CSS-owy podgląd w
// CanvasWidget.tsx, co jest jawnie udokumentowane jako znane ograniczenie v1.
import { LVGLConfig, Widget } from '../types/widgets';
import { getFontRegistry } from './fontRegistry';
import { parseHexColor, colorToRgb } from './colorUtils';

const SUPPORTED_FONT_SIZES = [12, 14, 16, 20, 24, 28, 32, 36, 40, 48];

function nearestSupportedFontSize(px: number): number {
  return SUPPORTED_FONT_SIZES.reduce((best, size) =>
    Math.abs(size - px) < Math.abs(best - px) ? size : best, SUPPORTED_FONT_SIZES[0]);
}

function toHex(color: unknown): string | undefined {
  if (color === undefined || color === null) return undefined;
  if (typeof color === 'object' && color !== null && 'r' in (color as any)) {
    const rgb = colorToRgb(color as any); // "rgb(r, g, b)"
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb);
    if (!m) return undefined;
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  // parseHexColor() prepends its own '#' and assumes none is already present (it just
  // pads+prefixes) - stripping a leading '#' here avoids a "##rrggbb" result for values
  // that (unlike the Color-object case above) already come pre-formatted with one.
  const str = typeof color === 'string' ? color.replace(/^#/, '') : color;
  return parseHexColor(str as string | number);
}

/** Te same typy, które wasm/interpreter.c potrafi zbudować. Reszta (meter, spinner, image,
 * msgbox, spinbox, buttonmatrix w pełni...) jest na razie pomijana. */
const SUPPORTED_TYPES = new Set([
  'obj', 'label', 'button', 'bar', 'slider', 'switch', 'checkbox', 'arc', 'led',
  'dropdown', 'roller', 'textarea', 'line',
]);

export interface PreviewNode {
  type: string;
  x?: number; y?: number; width?: number; height?: number; align?: string;
  bg_color?: string; bg_opa?: number;
  text_color?: string;
  border_color?: string; border_width?: number;
  radius?: number;
  pad_all?: number; pad_top?: number; pad_right?: number; pad_bottom?: number; pad_left?: number;
  text_font?: number;
  text?: string;
  value?: number; min?: number; max?: number;
  checked?: boolean;
  options?: string;
  children?: PreviewNode[];
}

export interface PreviewScene {
  screen_bg_color?: string;
  widgets: PreviewNode[];
}

function mergedStyles(widget: Widget, config: LVGLConfig): Record<string, any> {
  if (!(widget as any).styles || !config.style_definitions) return {};
  const names = String((widget as any).styles).split(' ');
  const merged: Record<string, any> = {};
  names.forEach(name => {
    const def = config.style_definitions?.find(s => s.id === name);
    if (def) Object.assign(merged, def);
  });
  return merged;
}

function serializeWidget(widget: Widget, config: LVGLConfig, fontRegistry: ReturnType<typeof getFontRegistry>): PreviewNode | null {
  if (!SUPPORTED_TYPES.has(widget.type)) return null;

  const styles = mergedStyles(widget, config);
  const w = widget as any;
  const node: PreviewNode = { type: widget.type };

  if (typeof w.x === 'number') node.x = w.x;
  if (typeof w.y === 'number') node.y = w.y;
  if (typeof w.width === 'number') node.width = w.width;
  if (typeof w.height === 'number') node.height = w.height;
  if (w.align) node.align = String(w.align).toUpperCase();

  const bg = styles.bg_color ?? w.bg_color;
  if (bg !== undefined) {
    node.bg_color = toHex(bg);
    const opa = styles.bg_opa ?? w.opacity;
    if (opa !== undefined) node.bg_opa = typeof opa === 'number' ? opa : 255;
  }
  const textColor = styles.text_color ?? w.text_color;
  if (textColor !== undefined) node.text_color = toHex(textColor);

  const borderColor = styles.border_color ?? w.border_color;
  const borderWidth = styles.border_width ?? w.border_width;
  if (borderWidth !== undefined) {
    node.border_width = borderWidth;
    node.border_color = toHex(borderColor) ?? '#555555';
  }

  const radius = styles.radius ?? w.radius;
  if (radius !== undefined) node.radius = radius;

  const padAll = styles.pad_all ?? w.pad_all;
  if (padAll !== undefined) node.pad_all = padAll;
  (['top', 'right', 'bottom', 'left'] as const).forEach(side => {
    const key = `pad_${side}` as const;
    const value = styles[key] ?? w[key];
    if (value !== undefined) (node as any)[key] = value;
  });

  const fontId = styles.text_font || w.text_font;
  if (fontId) {
    const entry = fontRegistry.get(fontId);
    if (entry) node.text_font = nearestSupportedFontSize(entry.size);
  }

  switch (widget.type) {
    case 'label':
      node.text = w.text || '';
      break;
    case 'button': {
      const child = w.widgets?.[0];
      node.text = child && 'text' in child ? (child.text || 'BUTTON') : 'BUTTON';
      break;
    }
    case 'checkbox':
      node.text = w.text || '';
      node.checked = Boolean(w.checked);
      break;
    case 'switch':
      node.checked = Boolean(w.checked);
      break;
    case 'bar':
    case 'slider':
      node.min = w.min_value ?? 0;
      node.max = w.max_value ?? 100;
      node.value = w.value ?? 0;
      break;
    case 'arc':
      node.min = w.min_value ?? 0;
      node.max = w.max_value ?? 100;
      node.value = w.value ?? 0;
      break;
    case 'led':
      node.checked = w.checked !== false;
      break;
    case 'dropdown':
    case 'roller':
      node.options = Array.isArray(w.options) ? w.options.join('\n') : (w.options || 'Opcja 1\nOpcja 2');
      break;
    case 'textarea':
      node.text = w.text || '';
      break;
  }

  if (widget.type === 'obj' && Array.isArray(w.widgets)) {
    const children = w.widgets
      .map((child: Widget) => serializeWidget(child, config, fontRegistry))
      .filter((n: PreviewNode | null): n is PreviewNode => n !== null);
    if (children.length) node.children = children;
  }

  return node;
}

export function serializePageForPreview(config: LVGLConfig, pageId: string): PreviewScene {
  const page = config.pages.find(p => p.id === pageId);
  const fontRegistry = getFontRegistry(config.fonts);
  const widgets = (page?.widgets || [])
    .map(widget => serializeWidget(widget, config, fontRegistry))
    .filter((n): n is PreviewNode => n !== null);

  return {
    screen_bg_color: toHex(config.bg_color) ?? '#ffffff',
    widgets,
  };
}
