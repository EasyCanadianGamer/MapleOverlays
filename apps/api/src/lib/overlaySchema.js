'use strict';

// The single source of truth for overlay settings. The dashboard renders its
// settings panel from schemaFor(), and sanitize() is built from the same
// definitions, so what the panel offers and what the server accepts cannot drift.

const KINDS = ['chat', 'nowplaying'];

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FONT_RE = /^(?:(?:builtin|google):[A-Za-z0-9 ._-]{1,60}|upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
// Control characters except tab, newline and carriage return.
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM_LEN = 50;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 300;
const MAX_OVERLAYS = 20;
const KIND_LABELS = { chat: 'Chat overlay', nowplaying: 'Now Playing' };

const number = (key, label, min, max, def, extra = {}) => ({ key, label, type: 'number', min, max, default: def, ...extra });
const bool = (key, label, def, extra = {}) => ({ key, label, type: 'boolean', default: def, ...extra });
const color = (key, label, def, extra = {}) => ({ key, label, type: 'color', default: def, ...extra });
const select = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, default: def, ...extra });
const longText = (key, label, maxLength, def, extra = {}) => ({ key, label, type: 'text', maxLength, default: def, ...extra });
const list = (key, label, maxLength, def, extra = {}) => ({ key, label, type: 'list', maxLength, default: def, ...extra });
const font = (key, label, def, extra = {}) => ({ key, label, type: 'font', default: def, ...extra });

const opt = (value, label) => ({ value, label });

const SCHEMAS = {
  chat: {
    sections: [
      {
        id: 'layout', label: 'Layout', fields: [
          select('direction', 'Direction', [opt('bottom', 'Newest at the bottom'), opt('top', 'Newest at the top')], 'bottom'),
          number('maxMessages', 'Max messages on screen', 1, 50, 12),
          number('lifetimeSeconds', 'Message lifetime (seconds)', 0, 600, 0, { help: '0 keeps messages until newer ones push them out.' }),
          number('fadeSeconds', 'Fade-out time (seconds)', 0, 10, 1),
          number('spacing', 'Spacing between messages (px)', 0, 40, 6),
        ],
      },
      {
        id: 'typography', label: 'Typography', fields: [
          font('font', 'Font', 'builtin:Geist'),
          number('fontSize', 'Size (px)', 10, 96, 22),
          select('fontWeight', 'Weight', [opt('400', 'Regular'), opt('500', 'Medium'), opt('600', 'Semi-bold'), opt('700', 'Bold'), opt('800', 'Extra bold')], '500'),
          color('textColor', 'Text color', '#ffffff'),
          bool('textShadow', 'Text shadow', true),
        ],
      },
      {
        id: 'username', label: 'Username', fields: [
          bool('useTwitchColor', 'Use each viewer’s Twitch color', true),
          color('usernameColor', 'Custom username color', '#ffffff', { help: 'Used when the Twitch color is switched off.' }),
          bool('usernameBold', 'Bold usernames', true),
          bool('showBadges', 'Show badges', true),
        ],
      },
      {
        id: 'messageBox', label: 'Message box', fields: [
          color('bgColor', 'Background color', '#000000'),
          number('bgOpacity', 'Background opacity (%)', 0, 100, 0),
          number('borderWidth', 'Border width (px)', 0, 10, 0),
          color('borderColor', 'Border color', '#ffffff'),
          number('radius', 'Corner rounding (px)', 0, 40, 8),
          number('padding', 'Padding (px)', 0, 40, 6),
          bool('bubble', 'Separate box for each message', false, { help: 'Off draws one box around the whole chat.' }),
        ],
      },
      {
        id: 'animation', label: 'Animation', fields: [
          select('entrance', 'Entrance', [opt('none', 'None'), opt('fade', 'Fade'), opt('slide', 'Slide'), opt('pop', 'Pop')], 'slide'),
          number('animationMs', 'Entrance speed (ms)', 0, 2000, 300),
        ],
      },
      {
        id: 'filters', label: 'Filters', fields: [
          bool('hideCommands', 'Hide commands (messages starting with !)', true),
          list('hiddenUsers', 'Hide these users', 500, '', { help: 'Comma-separated usernames, for example your other bots.' }),
          list('blockedWords', 'Hide messages containing', 1000, '', { help: 'Comma-separated words or phrases. Matches anywhere in the message.' }),
        ],
      },
      {
        id: 'emotes', label: 'Emotes', fields: [
          number('emoteScale', 'Emote size (%)', 50, 300, 100),
          bool('twitchEmotes', 'Twitch emotes', true),
          bool('sevenTv', '7TV emotes', true),
          bool('bttv', 'BetterTTV emotes', true),
          bool('ffz', 'FrankerFaceZ emotes', true),
        ],
      },
      {
        id: 'customCss', label: 'Custom CSS', fields: [
          longText('customCss', 'CSS', 5000, '', { help: 'Optional. Style .mw-chat, .mw-msg, .mw-user, .mw-text, .mw-badge and .mw-emote. No JavaScript.' }),
        ],
      },
    ],
  },

  nowplaying: {
    sections: [
      {
        id: 'style', label: 'Style', fields: [
          color('bgColor', 'Background color', '#0c0806'),
          color('textColor', 'Text color', '#ffffff'),
          select('size', 'Size', [opt('lg', 'Large'), opt('md', 'Medium'), opt('sm', 'Small')], 'md'),
          bool('transparentBackground', 'Transparent background', false),
          number('shadowOpacity', 'Shadow opacity (%)', 0, 100, 40),
          number('cornerRounding', 'Corner rounding (px)', 0, 50, 15),
          font('font', 'Font face', 'builtin:Geist'),
        ],
      },
      {
        id: 'other', label: 'Other', fields: [
          bool('stayOpen', 'Stay open all the time', false, { help: 'The card stays on screen while a track is playing, and hides when playback stops.' }),
          bool('onlyOnCommand', 'Only trigger on command, not on song change', false, { help: 'The command is !song. Enable, disable or restrict it on the Bot → Commands page.' }),
        ],
      },
      {
        id: 'customize', label: 'Customize', fields: [
          number('popupSeconds', 'Length of popup (seconds)', 2, 100, 10, { help: 'Ignored when the card stays open all the time.' }),
        ],
      },
    ],
  },
};

function isKind(value) {
  return typeof value === 'string' && KINDS.includes(value);
}

function requireKind(kind) {
  if (!isKind(kind)) throw new TypeError(`Unknown overlay kind: ${String(kind)}`);
}

function fieldsOf(kind) {
  requireKind(kind);
  return SCHEMAS[kind].sections.flatMap(s => s.fields);
}

function schemaFor(kind) {
  requireKind(kind);
  return SCHEMAS[kind];
}

function defaultsFor(kind) {
  const out = {};
  for (const f of fieldsOf(kind)) out[f.key] = f.default;
  return out;
}

function stripStyleClose(value) {
  let v = value;
  while (/<\/style/i.test(v)) v = v.replace(/<\/style/gi, '');
  return v;
}

function normalizeList(value, maxLength) {
  const seen = new Set();
  const items = [];
  for (const raw of value.replace(CONTROL_RE, '').split(/[,\n]/)) {
    const item = raw.trim().toLowerCase().slice(0, MAX_LIST_ITEM_LEN);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (items.length >= MAX_LIST_ITEMS) break;
  }
  return items.join(', ').slice(0, maxLength);
}

function sanitizeField(field, value) {
  switch (field.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return field.default;
      return Math.min(field.max, Math.max(field.min, Math.round(value)));
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : field.default;
    case 'color':
      return typeof value === 'string' && COLOR_RE.test(value) ? value.toLowerCase() : field.default;
    case 'select':
      return field.options.some(o => o.value === value) ? value : field.default;
    case 'font':
      return typeof value === 'string' && FONT_RE.test(value) ? value : field.default;
    case 'text':
      return typeof value === 'string'
        ? stripStyleClose(value.replace(CONTROL_RE, '')).slice(0, field.maxLength)
        : field.default;
    case 'list':
      return typeof value === 'string' ? normalizeList(value, field.maxLength) : field.default;
    default:
      return field.default;
  }
}

function sanitize(kind, input) {
  const fields = fieldsOf(kind);
  const source = input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const f of fields) {
    out[f.key] = Object.prototype.hasOwnProperty.call(source, f.key)
      ? sanitizeField(f, source[f.key])
      : f.default;
  }
  return out;
}

// An overlay's name and description live on the overlay row, not in its settings.
function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return name || null;
}

function cleanDescription(value) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_MAX);
}

// base, then "base 2", "base 3", ... never longer than NAME_MAX.
function firstFree(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = base.slice(0, NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

function defaultName(kind, existingNames) {
  requireKind(kind);
  return firstFree(KIND_LABELS[kind], new Set(existingNames));
}

function copyName(name, existingNames) {
  const base = `${name} copy`.slice(0, NAME_MAX).trimEnd();
  return firstFree(base, new Set(existingNames));
}

module.exports = {
  KINDS, NAME_MAX, DESCRIPTION_MAX, MAX_OVERLAYS,
  isKind, schemaFor, defaultsFor, sanitize, cleanName, cleanDescription, defaultName, copyName,
};
