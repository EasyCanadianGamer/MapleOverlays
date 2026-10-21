import { describe, expect, it } from 'vitest';
import { artAttempts, usableArtUrl } from './albumArt';

const REAL = 'https://lastfm-img.freetls.fastly.net/i/u/300x300/91068d72cb29fa29bc41cfae0a2c17b4.jpg';
const STAR = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';

describe('usableArtUrl', () => {
  it('keeps a real cover url', () => {
    expect(usableArtUrl(REAL)).toBe(REAL);
    expect(usableArtUrl('  https://example.com/xl.jpg  ')).toBe('https://example.com/xl.jpg');
  });

  it('drops missing, empty and non-http values', () => {
    for (const bad of [undefined, null, '', '   ', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '/relative.png', 'ftp://x/y.png', 5, {}]) {
      expect(usableArtUrl(bad as unknown as string)).toBeNull();
    }
  });

  it('drops the grey star Last.fm sends when it has no cover, at any size', () => {
    expect(usableArtUrl(STAR)).toBeNull();
    expect(usableArtUrl('https://lastfm.freetls.fastly.net/i/u/174s/2a96cbd8b46e442fc41c2b86b821562f.png')).toBeNull();
  });
});

describe('artAttempts', () => {
  it('tries the url, then the other Last.fm image host, then a cache-busted copy', () => {
    expect(artAttempts(REAL)).toEqual([
      REAL,
      'https://lastfm.freetls.fastly.net/i/u/300x300/91068d72cb29fa29bc41cfae0a2c17b4.jpg',
      `${REAL}?r=1`,
    ]);
    expect(artAttempts('https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg')).toEqual([
      'https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg',
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg',
      'https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg?r=1',
    ]);
  });

  it('only adds a cache-busted retry for other hosts', () => {
    expect(artAttempts('https://example.com/xl.jpg')).toEqual(['https://example.com/xl.jpg', 'https://example.com/xl.jpg?r=1']);
  });

  it('keeps an existing query string when it retries', () => {
    expect(artAttempts('https://example.com/xl.jpg?size=big')[1]).toBe('https://example.com/xl.jpg?size=big&r=1');
  });

  it('never throws on something that is not a url', () => {
    expect(artAttempts('not a url')).toEqual(['not a url']);
    expect(artAttempts('')).toEqual(['']);
  });
});
