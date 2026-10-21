// A font is stored in an overlay config as one string:
//   builtin:<family>   a font bundled with the dashboard
//   google:<family>    a Google Fonts family
//   upload:<uuid>      a font the owner uploaded
// The server validates the same shapes; this module is the browser side.

export const BUILT_IN_FONTS = ['Geist', 'Geist Mono', 'Bricolage Grotesque'];

export type FontSource = 'builtin' | 'google' | 'upload';
export interface FontRef { source: FontSource; value: string }

export const FAMILY_RE = /^[A-Za-z0-9 ._-]{1,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEFAULT_FONT: FontRef = { source: 'builtin', value: 'Geist' };

export function parseFontRef(ref: string): FontRef {
  const match = /^(builtin|google|upload):(.+)$/.exec(ref);
  if (!match) return DEFAULT_FONT;
  const source = match[1] as FontSource;
  const value = match[2];
  const valid = source === 'upload' ? UUID_RE.test(value) : FAMILY_RE.test(value);
  return valid ? { source, value } : DEFAULT_FONT;
}

export function cssFamily(ref: string): string {
  const font = parseFontRef(ref);
  const name = font.source === 'upload' ? `mw-upload-${font.value}` : font.value;
  return `"${name}", sans-serif`;
}

// Old Now Playing links pass ?font=<family name>.
export function legacyFontRef(name: string): string {
  const trimmed = name.trim();
  if (BUILT_IN_FONTS.includes(trimmed)) return `builtin:${trimmed}`;
  return FAMILY_RE.test(trimmed) ? `google:${trimmed}` : 'builtin:Geist';
}
