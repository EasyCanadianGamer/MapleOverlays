import { describe, expect, it } from 'vitest';
import { shouldShow, splitList } from './filters';

const open = { hideCommands: false, hiddenUsers: '', blockedWords: '' };

describe('splitList', () => {
  it('splits on commas and newlines, lowercases and drops blanks', () => {
    expect(splitList('Nightbot, , StreamElements\nMoobot')).toEqual(['nightbot', 'streamelements', 'moobot']);
    expect(splitList('')).toEqual([]);
    expect(splitList(' , ,')).toEqual([]);
  });
});

describe('shouldShow', () => {
  it('shows everything when no filters are set', () => {
    expect(shouldShow({ login: 'bob', text: '!hello BadWord' }, open)).toBe(true);
  });

  it('hides commands when asked, even with leading spaces', () => {
    const cfg = { ...open, hideCommands: true };
    expect(shouldShow({ login: 'bob', text: '!song' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'bob', text: '   !song' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'bob', text: 'wow! nice' }, cfg)).toBe(true);
  });

  it('hides listed users regardless of case', () => {
    const cfg = { ...open, hiddenUsers: 'Nightbot, other_bot' };
    expect(shouldShow({ login: 'nightbot', text: 'hi' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'OTHER_BOT', text: 'hi' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'bob', text: 'hi' }, cfg)).toBe(true);
  });

  it('hides messages containing a blocked word anywhere, case-insensitively', () => {
    const cfg = { ...open, blockedWords: 'spoiler, buy followers' };
    expect(shouldShow({ login: 'a', text: 'SPOILER alert' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'a', text: 'you can Buy Followers here' }, cfg)).toBe(false);
    expect(shouldShow({ login: 'a', text: 'nice stream' }, cfg)).toBe(true);
  });
});
