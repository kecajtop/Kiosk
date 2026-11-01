import { FontDefinition } from '../types/widgets';

export interface ResolvedFont {
  /** CSS font-family stack */
  fontFamily: string;
  /** Size in pixels */
  size: number;
  /** Whether this font includes icon glyphs (Material Icons etc.) */
  hasIcons: boolean;
}

const loadedLinks = new Set<string>();

function injectLink(href: string) {
  if (loadedLinks.has(href)) return;
  loadedLinks.add(href);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Convert a gfonts:// family name to a Google Fonts CSS2 URL */
function gfontsUrl(family: string): string {
  const encoded = family.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
}

/** Guess a system/web font-family from a local TTF filename */
function familyFromFile(filePath: string): string {
  const name = filePath.split('/').pop()?.toLowerCase() || '';
  if (name.includes('arial')) return "'Arial', sans-serif";
  if (name.includes('roboto')) return "'Roboto', sans-serif";
  if (name.includes('open_sans') || name.includes('opensans')) return "'Open Sans', sans-serif";
  if (name.includes('noto')) return "'Noto Sans', sans-serif";
  if (name.includes('ubuntu')) return "'Ubuntu', sans-serif";
  if (name.includes('lato')) return "'Lato', sans-serif";
  if (name.includes('montserrat')) return "'Montserrat', sans-serif";
  if (name.includes('material')) return "'Material Icons', sans-serif";
  return "Arial, sans-serif";
}

/** Check if a font file path is for an icon / glyph font */
function isIconFont(filePath: string): boolean {
  const name = filePath.toLowerCase();
  return name.includes('material') || name.includes('icons') ||
         name.includes('fontawesome') || name.includes('fa-');
}

/**
 * Build a registry mapping font-id → ResolvedFont.
 * Side effect: injects CSS <link> tags to load remote fonts.
 */
export function buildFontRegistry(fonts: FontDefinition[]): Map<string, ResolvedFont> {
  const registry = new Map<string, ResolvedFont>();

  for (const font of fonts) {
    let baseFamilies: string[] = [];
    let hasIcons = false;

    // ---- resolve base font ----
    if (font.file.startsWith('gfonts://')) {
      const familyName = font.file.replace('gfonts://', '');
      injectLink(gfontsUrl(familyName));
      baseFamilies.push(`'${familyName}'`, 'sans-serif');
    } else {
      baseFamilies.push(familyFromFile(font.file));
    }

    // ---- resolve extras (icon/glyph fonts) ----
    if (font.extras && font.extras.length > 0) {
      for (const extra of font.extras) {
        if (!extra.file) continue;
        if (isIconFont(extra.file)) {
          hasIcons = true;
          if (extra.file.toLowerCase().includes('material')) {
            // Load Material Icons from Google Fonts CDN
            injectLink('https://fonts.googleapis.com/icon?family=Material+Icons');
            // Prepend so icon codepoints are resolved first
            baseFamilies = ["'Material Icons'", ...baseFamilies];
          }
        }
      }
    }

    registry.set(font.id, {
      fontFamily: baseFamilies.join(', '),
      size: font.size || 14,
      hasIcons,
    });
  }

  return registry;
}

/** Cached registry keyed by a JSON fingerprint of the fonts array */
let cachedFonts: FontDefinition[] | null = null;
let cachedRegistry: Map<string, ResolvedFont> | null = null;

export function getFontRegistry(fonts: FontDefinition[] | undefined): Map<string, ResolvedFont> {
  if (!fonts || fonts.length === 0) return new Map();
  // cheap reference equality check — rebuild only when config.fonts changes
  if (fonts === cachedFonts && cachedRegistry) return cachedRegistry;
  cachedFonts = fonts;
  cachedRegistry = buildFontRegistry(fonts);
  return cachedRegistry;
}
