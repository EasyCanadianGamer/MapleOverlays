const { test } = require('node:test');
const assert = require('node:assert/strict');

const PLAYING_RESPONSE = {
  recenttracks: {
    track: [{
      name: 'Blinding Lights',
      artist: { '#text': 'The Weeknd' },
      album:  { '#text': 'After Hours' },
      image: [
        { size: 'small',      '#text': 'https://example.com/small.jpg' },
        { size: 'extralarge', '#text': 'https://example.com/xl.jpg' },
      ],
      '@attr': { nowplaying: 'true' },
    }],
  },
};

const IDLE_RESPONSE = {
  recenttracks: {
    track: [{
      name:   'Old Song',
      artist: { '#text': 'Someone' },
      album:  { '#text': 'An Album' },
      image:  [],
    }],
  },
};

const NO_IMAGE_RESPONSE = {
  recenttracks: {
    track: [{
      name:   'Track',
      artist: { '#text': 'Artist' },
      album:  { '#text': 'Album' },
      image:  [{ size: 'small', '#text': 'https://example.com/s.jpg' }],
      '@attr': { nowplaying: 'true' },
    }],
  },
};

test('returns structured data when track is playing', async () => {
  const orig = global.fetch;
  process.env.LASTFM_API_KEY = 'test_key';
  global.fetch = async () => ({ ok: true, json: async () => PLAYING_RESPONSE });
  delete require.cache[require.resolve('../src/index.js')];
  const { getNowPlayingData } = require('../src/index.js');

  const result = await getNowPlayingData('testuser');

  assert.equal(result.isPlaying, true);
  assert.equal(result.track,     'Blinding Lights');
  assert.equal(result.artist,    'The Weeknd');
  assert.equal(result.album,     'After Hours');
  assert.equal(result.albumArt,  'https://example.com/xl.jpg');
  global.fetch = orig;
});

test('returns isPlaying:false when nothing is now-playing', async () => {
  const orig = global.fetch;
  process.env.LASTFM_API_KEY = 'test_key';
  global.fetch = async () => ({ ok: true, json: async () => IDLE_RESPONSE });
  delete require.cache[require.resolve('../src/index.js')];
  const { getNowPlayingData } = require('../src/index.js');

  const result = await getNowPlayingData('testuser');

  assert.equal(result.isPlaying, false);
  global.fetch = orig;
});

test('falls back to empty string when extralarge image is absent', async () => {
  const orig = global.fetch;
  process.env.LASTFM_API_KEY = 'test_key';
  global.fetch = async () => ({ ok: true, json: async () => NO_IMAGE_RESPONSE });
  delete require.cache[require.resolve('../src/index.js')];
  const { getNowPlayingData } = require('../src/index.js');

  const result = await getNowPlayingData('testuser');

  assert.equal(result.isPlaying, true);
  assert.equal(result.albumArt,  '');
  global.fetch = orig;
});

function playing(images) {
  return { recenttracks: { track: [{ name: 'T', artist: { '#text': 'A' }, album: { '#text': 'B' }, image: images, '@attr': { nowplaying: 'true' } }] } };
}

async function artFor(images) {
  const orig = global.fetch;
  process.env.LASTFM_API_KEY = 'test_key';
  global.fetch = async () => ({ ok: true, json: async () => playing(images) });
  delete require.cache[require.resolve('../src/index.js')];
  const { getNowPlayingData } = require('../src/index.js');
  try {
    return (await getNowPlayingData('testuser')).albumArt;
  } finally {
    global.fetch = orig;
  }
}

const STAR = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';

test('uses the large image when the extralarge one is empty', async () => {
  const art = await artFor([
    { size: 'large',      '#text': 'https://example.com/l.jpg' },
    { size: 'extralarge', '#text': '' },
  ]);
  assert.equal(art, 'https://example.com/l.jpg');
});

test('prefers extralarge when both sizes have a cover', async () => {
  const art = await artFor([
    { size: 'large',      '#text': 'https://example.com/l.jpg' },
    { size: 'extralarge', '#text': 'https://example.com/xl.jpg' },
  ]);
  assert.equal(art, 'https://example.com/xl.jpg');
});

test('skips the grey star placeholder Last.fm sends when it has no cover', async () => {
  const art = await artFor([
    { size: 'large',      '#text': 'https://example.com/l.jpg' },
    { size: 'extralarge', '#text': STAR },
  ]);
  assert.equal(art, 'https://example.com/l.jpg');
});

test('returns an empty string when every size is blank or the placeholder', async () => {
  assert.equal(await artFor([{ size: 'large', '#text': STAR }, { size: 'extralarge', '#text': '' }]), '');
  assert.equal(await artFor([]), '');
});
