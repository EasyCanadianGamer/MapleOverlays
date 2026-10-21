import { useEffect } from 'react';
import { parseFontRef } from './fontRef';
import { fontFileUrl } from './overlayApi';

// Makes the font named by a font reference available to the page. Built-in
// fonts are already bundled with the dashboard, so only Google and uploaded
// fonts need work. Safe to call repeatedly: each font is injected once.
export function useOverlayFont(ref: string): void {
  useEffect(() => {
    const font = parseFontRef(ref);
    if (font.source === 'builtin') return;

    if (font.source === 'google') {
      const id = `mw-gfont-${font.value.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      // The v1 CSS API ignores weights a family does not have, unlike css2, which rejects the whole request.
      link.href = `https://fonts.googleapis.com/css?family=${encodeURIComponent(font.value)}:400,500,600,700,800&display=swap`;
      document.head.appendChild(link);
      return;
    }

    const id = `mw-upload-style-${font.value}`;
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `@font-face{font-family:"mw-upload-${font.value}";src:url("${fontFileUrl(font.value)}");font-display:swap;}`;
    document.head.appendChild(style);
  }, [ref]);
}
