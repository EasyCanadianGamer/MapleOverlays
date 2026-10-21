'use strict';

const MAX_FONT_BYTES = 2 * 1024 * 1024;
const MAX_FONTS_PER_CHANNEL = 10;
const MIME = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

// The format comes from the file's own leading bytes. The extension and the
// declared content type are ignored because both are chosen by the uploader.
function detectFontFormat(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true') return 'ttf';
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return 'ttf';
  return null;
}

// A display name only. The overlay never puts it into CSS (it uses the font's
// uuid), but it is kept safe anyway because it is shown in the dashboard.
function cleanFamily(family, filename) {
  const fromFamily = typeof family === 'string' && family.trim() ? family : null;
  const fromFile = typeof filename === 'string' ? filename.replace(/\.[A-Za-z0-9]{2,5}$/, '') : '';
  const base = fromFamily ?? fromFile;
  const cleaned = base.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned || 'Custom font';
}

module.exports = { MAX_FONT_BYTES, MAX_FONTS_PER_CHANNEL, MIME, detectFontFormat, cleanFamily };
