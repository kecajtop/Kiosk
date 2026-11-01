import { FontDefinition } from '../types/widgets';

export interface ResolvedPreviewFont {
  fontSizePx: number;
  fontSize: string;
  fontFamily: string;
}

export interface PreviewTextMeasureOptions {
  text: string;
  fontId?: string;
  fonts?: FontDefinition[];
  textLetterSpace?: number;
  textLineSpace?: number;
  padAll?: number;
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
  extraHorizontalPadding?: number;
  extraVerticalPadding?: number;
  minWidth?: number;
  minHeight?: number;
  forceUppercase?: boolean;
}

export interface PreviewTextMetrics extends ResolvedPreviewFont {
  width: number;
  height: number;
  lineHeight: number;
  letterSpace: number;
  lineSpace: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

const resolveFontFamilyFromFile = (filePath: string): string => {
  const name = filePath.split('/').pop()?.toLowerCase() || '';
  if (name.includes('arial')) return "'Arial', sans-serif";
  if (name.includes('roboto')) return "'Roboto', sans-serif";
  if (name.includes('open_sans') || name.includes('opensans')) return "'Open Sans', sans-serif";
  if (name.includes('noto')) return "'Noto Sans', sans-serif";
  if (name.includes('ubuntu')) return "'Ubuntu', sans-serif";
  if (name.includes('lato')) return "'Lato', sans-serif";
  if (name.includes('montserrat')) return "'Montserrat', sans-serif";
  if (name.includes('material')) return "'Material Icons', sans-serif";
  return 'Arial, sans-serif';
};

export const resolvePreviewFont = (fontId: string | undefined, fonts?: FontDefinition[]): ResolvedPreviewFont => {
  if (fontId && fonts && fonts.length > 0) {
    const font = fonts.find(entry => entry.id === fontId);
    if (font) {
      return {
        fontSizePx: font.size || 14,
        fontSize: `${font.size || 14}px`,
        fontFamily: font.file.startsWith('gfonts://')
          ? `'${font.file.replace('gfonts://', '')}', sans-serif`
          : resolveFontFamilyFromFile(font.file),
      };
    }
  }

  let size = 14;
  if (fontId) {
    if (fontId.includes('large') || fontId.includes('big')) size = 32;
    else if (fontId.includes('small') || fontId.includes('tiny') || fontId.includes('_sm')) size = 14;
    else if (fontId.includes('medium')) size = 20;
    else {
      const match = fontId.match(/(\d+)$/);
      if (match) size = parseInt(match[1], 10);
    }
  }

  return {
    fontSizePx: size,
    fontSize: `${size}px`,
    fontFamily: 'Arial, sans-serif',
  };
};

const getPaddingValue = (specific: number | undefined, all: number | undefined) => specific ?? all ?? 0;

export const measurePreviewText = (options: PreviewTextMeasureOptions): PreviewTextMetrics => {
  const rawText = String(options.text ?? '');
  const text = options.forceUppercase ? rawText.toUpperCase() : rawText;
  const font = resolvePreviewFont(options.fontId, options.fonts);
  const letterSpace = options.textLetterSpace ?? 0;
  const lineSpace = options.textLineSpace ?? 0;
  const paddingTop = getPaddingValue(options.padTop, options.padAll);
  const paddingRight = getPaddingValue(options.padRight, options.padAll);
  const paddingBottom = getPaddingValue(options.padBottom, options.padAll);
  const paddingLeft = getPaddingValue(options.padLeft, options.padAll);
  const lines = String(text || ' ').split('\n');
  const estimatedLineHeight = Math.ceil(font.fontSizePx * 1.32);
  const averageCharWidth = Math.ceil(font.fontSizePx * 0.74);
  const safetyWidth = Math.max(10, Math.ceil(font.fontSizePx * 0.8));
  const extraHorizontalPadding = options.extraHorizontalPadding ?? 0;
  const extraVerticalPadding = options.extraVerticalPadding ?? 0;

  const estimateWidth = () => {
    const widestLine = lines.reduce((max, line) => {
      const glyphWidth = Math.ceil(line.length * averageCharWidth);
      const spacingWidth = Math.max(0, line.length - 1) * letterSpace;
      return Math.max(max, glyphWidth + spacingWidth);
    }, 0);
    return Math.max(
      options.minWidth ?? 0,
      widestLine + paddingLeft + paddingRight + safetyWidth + extraHorizontalPadding,
      lines.some(line => line.length > 0) ? font.fontSizePx * 2 : 0,
    );
  };

  const estimateHeight = () => Math.max(
    options.minHeight ?? 0,
    lines.length * estimatedLineHeight + Math.max(0, lines.length - 1) * lineSpace + paddingTop + paddingBottom + extraVerticalPadding,
    estimatedLineHeight + paddingTop + paddingBottom,
  );

  if (typeof document === 'undefined') {
    return {
      ...font,
      width: estimateWidth(),
      height: estimateHeight(),
      lineHeight: estimatedLineHeight,
      letterSpace,
      lineSpace,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return {
      ...font,
      width: estimateWidth(),
      height: estimateHeight(),
      lineHeight: estimatedLineHeight,
      letterSpace,
      lineSpace,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    };
  }

  context.font = `${font.fontSizePx}px ${font.fontFamily}`;
  const measuredLines = lines.map(line => {
    const metrics = context.measureText(line || ' ');
    return {
      width: Math.ceil(metrics.width + Math.max(0, line.length - 1) * letterSpace),
      height: Math.ceil(
        (metrics.actualBoundingBoxAscent || font.fontSizePx) +
        (metrics.actualBoundingBoxDescent || Math.ceil(font.fontSizePx * 0.24)),
      ),
    };
  });
  const lineHeight = Math.max(...measuredLines.map(line => line.height), estimatedLineHeight);
  const textWidth = measuredLines.reduce((max, line) => Math.max(max, line.width), 0);
  const textHeight = lines.length * lineHeight + Math.max(0, lines.length - 1) * lineSpace;

  return {
    ...font,
    width: Math.max(options.minWidth ?? 0, textWidth + paddingLeft + paddingRight + extraHorizontalPadding + safetyWidth),
    height: Math.max(options.minHeight ?? 0, textHeight + paddingTop + paddingBottom + extraVerticalPadding),
    lineHeight,
    letterSpace,
    lineSpace,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  };
};