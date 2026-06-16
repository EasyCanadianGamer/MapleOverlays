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
