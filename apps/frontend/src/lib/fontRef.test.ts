import { describe, expect, it } from 'vitest';
import { BUILT_IN_FONTS, cssFamily, legacyFontRef, parseFontRef } from './fontRef';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('parseFontRef', () => {
  it('parses builtin, google and upload references', () => {
    expect(parseFontRef('builtin:Geist Mono')).toEqual({ source: 'builtin', value: 'Geist Mono' });
    expect(parseFontRef('google:Press Start 2P')).toEqual({ source: 'google', value: 'Press Start 2P' });
    expect(parseFontRef(`upload:${UUID}`)).toEqual({ source: 'upload', value: UUID });
  });

  it('falls back to the default for anything invalid', () => {
    const fallback = { source: 'builtin', value: 'Geist' };
    for (const bad of ['', 'Geist', 'builtin:', 'google:a"b', 'google:<x>', 'upload:abc', `upload:${UUID.toUpperCase()}`, 'other:Geist', 'https://x/y.ttf']) {
      expect(parseFontRef(bad)).toEqual(fallback);
    }
  });
});

describe('cssFamily', () => {
  it('quotes named families and uses a unique name for uploads', () => {
    expect(cssFamily('builtin:Geist')).toBe('"Geist", sans-serif');
    expect(cssFamily('google:Roboto Mono')).toBe('"Roboto Mono", sans-serif');
    expect(cssFamily(`upload:${UUID}`)).toBe(`"mw-upload-${UUID}", sans-serif`);
  });

  it('never lets a hostile value reach CSS', () => {
    expect(cssFamily('google:a"; } body { x: y')).toBe('"Geist", sans-serif');
  });
});

describe('legacyFontRef', () => {
  it('maps the old ?font= parameter onto a font reference', () => {
    expect(legacyFontRef('Geist')).toBe('builtin:Geist');
    expect(legacyFontRef('Bricolage Grotesque')).toBe('builtin:Bricolage Grotesque');
    expect(legacyFontRef('Poppins')).toBe('google:Poppins');
    expect(legacyFontRef('  Poppins  ')).toBe('google:Poppins');
  });

  it('rejects unsafe names', () => {
    expect(legacyFontRef('a"b')).toBe('builtin:Geist');
    expect(legacyFontRef('')).toBe('builtin:Geist');
    expect(BUILT_IN_FONTS).toEqual(['Geist', 'Geist Mono', 'Bricolage Grotesque']);
  });
});
