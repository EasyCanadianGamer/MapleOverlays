import { describe, expect, it } from 'vitest';
import { parseBadges, parseEmoteTag, parseLine, parseTags } from './irc';

const PRIV =
  '@badge-info=subscriber/8;badges=subscriber/6,premium/1;color=#1E90FF;display-name=Cool_Viewer;' +
  'emotes=25:6-10,12-16/1902:18-22;id=abc-123;mod=0 ' +
  ':cool_viewer!cool_viewer@cool_viewer.tmi.twitch.tv PRIVMSG #streamer :hello Kappa Kappa Keepo';

describe('parseLine: messages', () => {
  it('parses a normal chat message', () => {
    expect(parseLine(PRIV)).toEqual({
      kind: 'message',
      id: 'abc-123',
      login: 'cool_viewer',
      displayName: 'Cool_Viewer',
      color: '#1E90FF',
      badges: [{ set: 'subscriber', version: '6' }, { set: 'premium', version: '1' }],
      emotes: [
        { id: '25', start: 6, end: 10 },
        { id: '25', start: 12, end: 16 },
        { id: '1902', start: 18, end: 22 },
      ],
      text: 'hello Kappa Kappa Keepo',
      isAction: false,
    });
  });

  it('falls back to the login for the display name and null for a missing color', () => {
    const msg = parseLine('@color=;display-name=;id=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #c :hi');
    expect(msg).toMatchObject({ kind: 'message', login: 'bob', displayName: 'bob', color: null });
  });

  it('unwraps /me actions', () => {
    const msg = parseLine('@id=2 :bob!bob@bob.tmi.twitch.tv PRIVMSG #c :\u0001ACTION waves hello\u0001');
    expect(msg).toMatchObject({ kind: 'message', text: 'waves hello', isAction: true });
  });

  it('keeps colons inside the message text', () => {
    const msg = parseLine('@id=3 :bob!bob@bob.tmi.twitch.tv PRIVMSG #c :hi : there :x');
    expect(msg).toMatchObject({ kind: 'message', text: 'hi : there :x' });
  });

  it('unescapes tag values', () => {
    const msg = parseLine('@display-name=Cool\\sViewer;id=4 :cool_viewer!x@x.tmi.twitch.tv PRIVMSG #c :hi');
    expect(msg).toMatchObject({ kind: 'message', displayName: 'Cool Viewer' });
  });

  it('survives a message with no tags at all', () => {
    expect(parseLine(':bob!bob@bob.tmi.twitch.tv PRIVMSG #c :plain')).toMatchObject({ kind: 'message', login: 'bob', text: 'plain', id: '', badges: [], emotes: [] });
  });
});

describe('parseLine: moderation events', () => {
  it('parses CLEARMSG (a deleted message)', () => {
    expect(parseLine('@login=troll;target-msg-id=xyz-9 :tmi.twitch.tv CLEARMSG #c :bad text'))
      .toEqual({ kind: 'clearmsg', targetMsgId: 'xyz-9' });
  });

  it('ignores a CLEARMSG that does not say which message', () => {
    expect(parseLine('@login=troll :tmi.twitch.tv CLEARMSG #c :bad')).toBeNull();
  });

  it('parses CLEARCHAT for one user (ban or timeout)', () => {
    expect(parseLine('@ban-duration=600;target-user-id=1 :tmi.twitch.tv CLEARCHAT #c :Troll'))
      .toEqual({ kind: 'clearchat', targetLogin: 'troll' });
  });

  it('parses CLEARCHAT for the whole chat', () => {
    expect(parseLine(':tmi.twitch.tv CLEARCHAT #c')).toEqual({ kind: 'clearchat', targetLogin: null });
  });
});

describe('parseLine: connection lines and junk', () => {
  it('recognises PING and the end-of-names reply', () => {
    expect(parseLine('PING :tmi.twitch.tv')).toEqual({ kind: 'ping' });
    expect(parseLine(':justinfan1.tmi.twitch.tv 366 justinfan1 #c :End of /NAMES list')).toEqual({ kind: 'joined' });
  });

  it('returns null for lines it does not care about', () => {
    expect(parseLine('@badge-info=;badges= :tmi.twitch.tv USERSTATE #c')).toBeNull();
    expect(parseLine(':tmi.twitch.tv 001 justinfan1 :Welcome, GLHF!')).toBeNull();
  });

  it('never throws on malformed input', () => {
    for (const junk of ['', '@', ':', '@a=b', ':nick', 'PRIVMSG', '@x :y', ':a!b@c PRIVMSG #c', ':!x PRIVMSG #c :no login']) {
      expect(() => parseLine(junk)).not.toThrow();
    }
    expect(parseLine(':a!b@c PRIVMSG #c')).toBeNull();
  });
});

describe('tag helpers', () => {
  it('parseTags splits and unescapes', () => {
    expect({ ...parseTags('a=1;b=x\\sy;c=') }).toEqual({ a: '1', b: 'x y', c: '' });
  });

  it('parseBadges handles empty and odd input', () => {
    expect(parseBadges(undefined)).toEqual([]);
    expect(parseBadges('')).toEqual([]);
    expect(parseBadges('moderator/1,,bits/100')).toEqual([{ set: 'moderator', version: '1' }, { set: 'bits', version: '100' }]);
  });

  it('parseEmoteTag sorts ranges and drops malformed ones', () => {
    expect(parseEmoteTag('1902:18-22/25:6-10,12-16')).toEqual([
      { id: '25', start: 6, end: 10 }, { id: '25', start: 12, end: 16 }, { id: '1902', start: 18, end: 22 },
    ]);
    expect(parseEmoteTag('')).toEqual([]);
    expect(parseEmoteTag(undefined)).toEqual([]);
    expect(parseEmoteTag('25:abc')).toEqual([]);
    expect(parseEmoteTag('nonsense')).toEqual([]);
    expect(parseEmoteTag('emotesv2_abc:0-4')).toEqual([{ id: 'emotesv2_abc', start: 0, end: 4 }]);
  });
});
