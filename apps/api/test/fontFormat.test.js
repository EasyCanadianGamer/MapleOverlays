const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_FONT_BYTES, MAX_FONTS_PER_CHANNEL, MIME, detectFontFormat, cleanFamily } = require('../src/lib/fontFormat');

const withMagic = (magic, total = 64) => Buffer.concat([Buffer.from(magic, 'latin1'), Buffer.alloc(total - magic.length, 1)]);

test('limits and mime types', () => {
  assert.equal(MAX_FONT_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_FONTS_PER_CHANNEL, 10);
  assert.deepEqual(MIME, { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' });
});

test('detects each supported format from its leading bytes', () => {
  assert.equal(detectFontFormat(withMagic('wOF2')), 'woff2');
  assert.equal(detectFontFormat(withMagic('wOFF')), 'woff');
  assert.equal(detectFontFormat(withMagic('OTTO')), 'otf');
  assert.equal(detectFontFormat(withMagic('true')), 'ttf');
  assert.equal(detectFontFormat(Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00]), Buffer.alloc(60, 1)])), 'ttf');
});

test('rejects files that are not fonts, whatever they claim to be', () => {
  const html = Buffer.from('<!doctype html><html><body>not a font</body></html>');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const zip = withMagic('PK\u0003\u0004');
  const ttc = withMagic('ttcf');
  const disguised = Buffer.concat([Buffer.from('<html>'), Buffer.from('wOF2'), Buffer.alloc(60, 1)]);
  for (const bad of [html, svg, zip, ttc, disguised]) {
    assert.equal(detectFontFormat(bad), null);
  }
});

test('rejects empty, tiny and non-buffer input', () => {
  assert.equal(detectFontFormat(Buffer.alloc(0)), null);
  assert.equal(detectFontFormat(Buffer.from('wOF2')), null);
  assert.equal(detectFontFormat(Buffer.alloc(11, 0)), null);
  assert.equal(detectFontFormat(Buffer.alloc(100, 0)), null);
  assert.equal(detectFontFormat('wOF2' + 'x'.repeat(60)), null);
  assert.equal(detectFontFormat(null), null);
  assert.equal(detectFontFormat(undefined), null);
  assert.equal(detectFontFormat({}), null);
});

test('cleanFamily keeps a readable name and strips anything CSS-unsafe', () => {
  assert.equal(cleanFamily('My Font', 'x.ttf'), 'My Font');
  assert.equal(cleanFamily('"; } body { background: red', 'x.ttf'), 'body background red');
  assert.equal(cleanFamily('<script>alert(1)</script>', 'x.ttf'), 'scriptalert1script');
  assert.equal(cleanFamily('  lots   of   space  ', 'x.ttf'), 'lots of space');
  assert.equal(cleanFamily('a'.repeat(200), 'x.ttf').length, 60);
});

test('cleanFamily falls back to the filename, then to a default', () => {
  assert.equal(cleanFamily(undefined, 'My Font-Bold.ttf'), 'My Font-Bold');
  assert.equal(cleanFamily('', 'Poppins.woff2'), 'Poppins');
  assert.equal(cleanFamily('   ', undefined), 'Custom font');
  assert.equal(cleanFamily('{}<>', '{}<>.otf'), 'Custom font');
  assert.equal(cleanFamily(42, null), 'Custom font');
});
