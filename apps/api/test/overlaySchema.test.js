const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  KINDS, NAME_MAX, DESCRIPTION_MAX, MAX_OVERLAYS,
  isKind, schemaFor, defaultsFor, sanitize, cleanName, cleanDescription, defaultName, copyName,
} = require('../src/lib/overlaySchema');

const UUID = '123e4567-e89b-12d3-a456-426614174000';

test('KINDS and isKind', () => {
  assert.deepEqual(KINDS, ['chat', 'nowplaying']);
  assert.equal(isKind('chat'), true);
  assert.equal(isKind('nowplaying'), true);
  assert.equal(isKind('alerts'), false);
  assert.equal(isKind(undefined), false);
  assert.equal(isKind('__proto__'), false);
});

test('unknown kind throws', () => {
  assert.throws(() => sanitize('alerts', {}), TypeError);
  assert.throws(() => defaultsFor('alerts'), TypeError);
  assert.throws(() => schemaFor('alerts'), TypeError);
});

test('schema is internally consistent and every default is valid', () => {
  for (const kind of KINDS) {
    const seen = new Set();
    for (const section of schemaFor(kind).sections) {
      assert.equal(typeof section.label, 'string');
      for (const f of section.fields) {
        assert.ok(!seen.has(f.key), `duplicate key ${kind}.${f.key}`);
        seen.add(f.key);
        assert.equal(typeof f.label, 'string', `${kind}.${f.key} needs a label`);
        assert.deepEqual(sanitize(kind, { [f.key]: f.default })[f.key], f.default, `${kind}.${f.key} default must survive sanitize`);
      }
    }
  }
});

test('defaults round-trip and are returned fresh each call', () => {
  for (const kind of KINDS) {
    assert.deepEqual(sanitize(kind, defaultsFor(kind)), defaultsFor(kind));
    assert.notEqual(defaultsFor(kind), defaultsFor(kind));
  }
});

test('missing or non-object input yields defaults', () => {
  for (const kind of KINDS) {
    for (const bad of [undefined, null, [], 'x', 5, true]) {
      assert.deepEqual(sanitize(kind, bad), defaultsFor(kind));
    }
  }
});

test('unknown keys are dropped and prototypes cannot be polluted', () => {
  const evil = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"extra":1,"fontSize":30}');
  const out = sanitize('chat', evil);
  assert.equal(out.fontSize, 30);
  assert.equal('extra' in out, false);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(out).sort(), Object.keys(defaultsFor('chat')).sort());
});

test('numbers are clamped, rounded, and only real numbers are accepted', () => {
  assert.equal(sanitize('chat', { fontSize: 9999 }).fontSize, 96);
  assert.equal(sanitize('chat', { fontSize: -5 }).fontSize, 10);
  assert.equal(sanitize('chat', { fontSize: 22.6 }).fontSize, 23);
  for (const bad of ['30', NaN, Infinity, -Infinity, null, {}, [], true]) {
    assert.equal(sanitize('chat', { fontSize: bad }).fontSize, 22, String(bad));
  }
  assert.equal(sanitize('nowplaying', { popupSeconds: 1 }).popupSeconds, 2);
  assert.equal(sanitize('nowplaying', { popupSeconds: 2 }).popupSeconds, 2);
  assert.equal(sanitize('nowplaying', { popupSeconds: 100 }).popupSeconds, 100);
  assert.equal(sanitize('nowplaying', { popupSeconds: 101 }).popupSeconds, 100);
});

test('booleans must be real booleans', () => {
  assert.equal(sanitize('chat', { textShadow: false }).textShadow, false);
  for (const bad of ['false', 0, 1, null, 'yes']) {
    assert.equal(sanitize('chat', { textShadow: bad }).textShadow, true, String(bad));
  }
});

test('colors must be #rrggbb and are lowercased', () => {
  assert.equal(sanitize('chat', { textColor: '#ABCDEF' }).textColor, '#abcdef');
  for (const bad of ['red', '#fff', '#12345', '#1234567', 'abcdef', 123, null, 'url(x)']) {
    assert.equal(sanitize('chat', { textColor: bad }).textColor, '#ffffff', String(bad));
  }
});

test('selects only accept listed values (as strings)', () => {
  assert.equal(sanitize('chat', { entrance: 'pop' }).entrance, 'pop');
  assert.equal(sanitize('chat', { entrance: 'spin' }).entrance, 'slide');
  assert.equal(sanitize('chat', { fontWeight: '700' }).fontWeight, '700');
  assert.equal(sanitize('chat', { fontWeight: 700 }).fontWeight, '500');
  assert.equal(sanitize('nowplaying', { size: 'lg' }).size, 'lg');
  assert.equal(sanitize('nowplaying', { size: 'xl' }).size, 'md');
});

test('font references: builtin, google and upload only', () => {
  for (const ok of ['builtin:Geist', 'google:Roboto Mono', `upload:${UUID}`, 'google:Press Start 2P']) {
    assert.equal(sanitize('chat', { font: ok }).font, ok, ok);
  }
  const bad = ['upload:abc', 'upload:' + UUID.toUpperCase(), 'builtin:', 'google:<script>', 'https://evil/x.ttf',
    'builtin:' + 'a'.repeat(61), 'google:a"b', 'other:Geist', 5, null, ''];
  for (const b of bad) {
    assert.equal(sanitize('chat', { font: b }).font, 'builtin:Geist', String(b));
  }
});

test('limits', () => {
  assert.equal(NAME_MAX, 60);
  assert.equal(DESCRIPTION_MAX, 300);
  assert.equal(MAX_OVERLAYS, 20);
});

test('cleanName trims, flattens, strips control characters and limits length', () => {
  assert.equal(cleanName('  Stage \n\t chat\u0000  '), 'Stage chat');
  assert.equal(cleanName('a'.repeat(100)), 'a'.repeat(60));
  assert.equal(cleanName('  ' + 'b'.repeat(59) + '   c'), 'b'.repeat(59));
  for (const bad of ['', '   ', '\n\t', '\u0000', 5, null, undefined, {}, []]) {
    assert.equal(cleanName(bad), null, String(bad));
  }
});

test('cleanDescription flattens and limits, and tolerates non-strings', () => {
  assert.equal(cleanDescription('  line one\nline two  '), 'line one line two');
  assert.equal(cleanDescription('d'.repeat(900)).length, 300);
  for (const bad of [5, null, undefined, {}]) assert.equal(cleanDescription(bad), '');
});

test('default names count up per kind and fill gaps', () => {
  assert.equal(defaultName('chat', []), 'Chat overlay');
  assert.equal(defaultName('chat', ['Chat overlay']), 'Chat overlay 2');
  assert.equal(defaultName('chat', ['Chat overlay', 'Chat overlay 2']), 'Chat overlay 3');
  assert.equal(defaultName('chat', ['Chat overlay', 'Chat overlay 3']), 'Chat overlay 2');
  assert.equal(defaultName('nowplaying', ['Chat overlay']), 'Now Playing');
  assert.equal(defaultName('nowplaying', ['Now Playing']), 'Now Playing 2');
  assert.throws(() => defaultName('alerts', []), TypeError);
});

test('copy names add "copy", then count up, and never exceed the name limit', () => {
  assert.equal(copyName('Stage', ['Stage']), 'Stage copy');
  assert.equal(copyName('Stage', ['Stage', 'Stage copy']), 'Stage copy 2');
  assert.equal(copyName('Stage', ['Stage', 'Stage copy', 'Stage copy 2']), 'Stage copy 3');
  const long = 'x'.repeat(60);
  const copy = copyName(long, [long]);
  assert.ok(copy.length <= 60);
  assert.notEqual(copy, long);
  const second = copyName(long, [long, copy]);
  assert.ok(second.length <= 60);
  assert.notEqual(second, copy);
});

test('custom CSS cannot close the style tag and is length-limited', () => {
  const css = sanitize('chat', { customCss: 'a{}\n</style><script>alert(1)</script>' }).customCss;
  assert.equal(/<\/style/i.test(css), false);
  assert.ok(css.includes('\n'), 'newlines are kept in CSS');

  const nested = sanitize('chat', { customCss: '<</style/style>' }).customCss;
  assert.equal(/<\/style/i.test(nested), false);
  const upper = sanitize('chat', { customCss: '</STYLE>' }).customCss;
  assert.equal(/<\/style/i.test(upper), false);

  assert.equal(sanitize('chat', { customCss: 'x'.repeat(1_000_000) }).customCss.length, 5000);
  assert.equal(sanitize('chat', { customCss: 42 }).customCss, '');
});

test('lists are normalised: lowercased, deduplicated, bounded', () => {
  assert.equal(sanitize('chat', { hiddenUsers: 'Nightbot, , StreamElements ,nightbot' }).hiddenUsers, 'nightbot, streamelements');
  assert.equal(sanitize('chat', { blockedWords: 'a\nB,c' }).blockedWords, 'a, b, c');
  const many = Array.from({ length: 500 }, (_, i) => `u${i}`).join(',');
  assert.ok(sanitize('chat', { hiddenUsers: many }).hiddenUsers.length <= 500);
  assert.equal(sanitize('chat', { hiddenUsers: 7 }).hiddenUsers, '');
});

test('chat defaults start empty: no filters, no custom CSS', () => {
  const d = defaultsFor('chat');
  assert.equal(d.hiddenUsers, '');
  assert.equal(d.blockedWords, '');
  assert.equal(d.customCss, '');
});
