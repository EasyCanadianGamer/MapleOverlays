import { describe, expect, it } from 'vitest';
import { buildFragments, twitchEmoteUrl, type EmoteOptions, type ThirdPartyEmotes } from './fragments';

const NONE: ThirdPartyEmotes = { sevenTv: {}, bttv: {}, ffz: {} };
const ALL: EmoteOptions = { twitch: true, sevenTv: true, bttv: true, ffz: true };

describe('buildFragments: Twitch emotes', () => {
  it('returns plain text unchanged', () => {
    expect(buildFragments('just words', [], NONE, ALL)).toEqual([{ type: 'text', text: 'just words' }]);
    expect(buildFragments('', [], NONE, ALL)).toEqual([]);
  });

  it('splits text around an emote range', () => {
    expect(buildFragments('hello Kappa world', [{ id: '25', start: 6, end: 10 }], NONE, ALL)).toEqual([
      { type: 'text', text: 'hello ' },
      { type: 'emote', name: 'Kappa', url: twitchEmoteUrl('25') },
      { type: 'text', text: ' world' },
    ]);
  });

  it('counts emoji as one position, the way Twitch does', () => {
    expect(buildFragments('😀 Kappa', [{ id: '25', start: 2, end: 6 }], NONE, ALL)).toEqual([
      { type: 'text', text: '😀 ' },
      { type: 'emote', name: 'Kappa', url: twitchEmoteUrl('25') },
    ]);
  });

  it('ignores ranges that run past the text, overlap, or are backwards', () => {
    expect(buildFragments('hi Kappa', [{ id: '25', start: 3, end: 99 }], NONE, ALL)).toEqual([{ type: 'text', text: 'hi Kappa' }]);
    expect(buildFragments('hi Kappa', [{ id: '25', start: 5, end: 3 }], NONE, ALL)).toEqual([{ type: 'text', text: 'hi Kappa' }]);
    expect(buildFragments('hi Kappa', [{ id: '25', start: -1, end: 2 }], NONE, ALL)).toEqual([{ type: 'text', text: 'hi Kappa' }]);
    const overlapping = buildFragments('abcdefghij', [{ id: '1', start: 2, end: 5 }, { id: '2', start: 4, end: 8 }], NONE, ALL);
    expect(overlapping.filter(f => f.type === 'emote')).toHaveLength(1);
  });

  it('accepts unsorted ranges', () => {
    const out = buildFragments('a b', [{ id: '2', start: 2, end: 2 }, { id: '1', start: 0, end: 0 }], NONE, ALL);
    expect(out.filter(f => f.type === 'emote').map(f => (f.type === 'emote' ? f.url : ''))).toEqual([twitchEmoteUrl('1'), twitchEmoteUrl('2')]);
  });

  it('leaves Twitch emotes as text when they are switched off', () => {
    expect(buildFragments('hello Kappa world', [{ id: '25', start: 6, end: 10 }], NONE, { ...ALL, twitch: false }))
      .toEqual([{ type: 'text', text: 'hello Kappa world' }]);
  });
});

describe('buildFragments: third-party emotes', () => {
  const tp: ThirdPartyEmotes = {
    sevenTv: { PogU: 'https://7tv/pogu', Shared: 'https://7tv/shared' },
    bttv: { monkaS: 'https://bttv/monkas', Shared: 'https://bttv/shared' },
    ffz: { ZrehplaR: 'https://ffz/z' },
  };

  it('replaces whole words that match a provider', () => {
    expect(buildFragments('hi PogU there', [], tp, ALL)).toEqual([
      { type: 'text', text: 'hi ' },
      { type: 'emote', name: 'PogU', url: 'https://7tv/pogu' },
      { type: 'text', text: ' there' },
    ]);
  });

  it('honours the per-provider switches', () => {
    expect(buildFragments('PogU monkaS ZrehplaR', [], tp, { ...ALL, sevenTv: false }).filter(f => f.type === 'emote')).toHaveLength(2);
    expect(buildFragments('PogU monkaS ZrehplaR', [], tp, { twitch: true, sevenTv: false, bttv: false, ffz: false })).toEqual([
      { type: 'text', text: 'PogU monkaS ZrehplaR' },
    ]);
  });

  it('prefers 7TV, then BTTV, then FFZ when names collide', () => {
    expect(buildFragments('Shared', [], tp, ALL)).toEqual([{ type: 'emote', name: 'Shared', url: 'https://7tv/shared' }]);
    expect(buildFragments('Shared', [], tp, { ...ALL, sevenTv: false })).toEqual([{ type: 'emote', name: 'Shared', url: 'https://bttv/shared' }]);
  });

  it('matches exact case and whole words only', () => {
    expect(buildFragments('pogu PogU, xPogU', [], tp, ALL)).toEqual([{ type: 'text', text: 'pogu PogU, xPogU' }]);
  });

  it('never mistakes inherited object properties for emotes', () => {
    const text = 'constructor toString __proto__ hasOwnProperty valueOf';
    expect(buildFragments(text, [], tp, ALL)).toEqual([{ type: 'text', text }]);
  });

  it('keeps all whitespace and merges adjacent text', () => {
    expect(buildFragments('a  b\tPogU\nc', [], tp, ALL)).toEqual([
      { type: 'text', text: 'a  b\t' },
      { type: 'emote', name: 'PogU', url: 'https://7tv/pogu' },
      { type: 'text', text: '\nc' },
    ]);
  });
});
