import { useState, useEffect, type ReactNode } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import Icon from '../components/ui/Icon';
import LivePill from '../components/ui/LivePill';
import MapleMark from '../components/ui/MapleMark';
import type { TwitchUser } from '../lib/twitchAuth';
import { buildBotAuthUrl, getToken } from '../lib/twitchAuth';

type ViewId = 'manager' | 'overlays' | 'bot' | 'settings';

type CmdCfg = { enabled: boolean; response: string; builtin?: boolean };

interface ChatMessage {
  kind: 'user' | 'bot';
  user: string;
  color?: string;
  text: ReactNode;
  mono?: boolean;
  badges?: string[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { kind: 'user', user: 'maeve',        color: '#4ED4B5', text: '!song',    mono: true },
  { kind: 'bot',  user: 'maple_bot',    text: <>Now playing: <strong>Bohemian Rhapsody</strong> by Queen 🎵</> },
  { kind: 'user', user: 'streamer_dad', color: '#FFB627', text: 'peak song choice' },
  { kind: 'user', user: 'ratking_99',   color: '#5BA8FF', text: '!uptime',  mono: true, badges: ['SUB 24'] },
  { kind: 'bot',  user: 'maple_bot',    text: <>Stream's been live for <strong>2h 14m</strong></> },
  { kind: 'user', user: 'lurking_loaf', color: '#C12F5D', text: '!lurk',   mono: true },
  { kind: 'bot',  user: 'maple_bot',    text: <><strong>lurking_loaf</strong> is lurking in the trees 🍁</> },
  { kind: 'user', user: 'maeve',        color: '#4ED4B5', text: '!so @ratking_99', mono: true, badges: ['MOD'] },
  { kind: 'bot',  user: 'maple_bot',    text: <>Go follow <strong>@ratking_99</strong> → twitch.tv/ratking_99</> },
];

const BUILTIN_COMMANDS = [
  { key: 'ping',       command: '!ping',       description: 'Checks if the bot is alive',               defaultResponse: 'pong!', dynamic: false },
  { key: 'song',       command: '!song',       description: 'Currently playing track via Last.fm',      defaultResponse: '',      dynamic: true  },
  { key: 'uptime',     command: '!uptime',     description: 'How long the stream has been live',        defaultResponse: '',      dynamic: true  },
  { key: 'downtime',   command: '!downtime',   description: 'How long the stream has been offline',     defaultResponse: '',      dynamic: true  },
  { key: 'followage',  command: '!followage',  description: 'How long the viewer has been following',   defaultResponse: '',      dynamic: true  },
  { key: 'accountage', command: '!accountage', description: "How old the viewer's Twitch account is",  defaultResponse: '',      dynamic: true  },
  { key: 'watchtime',  command: '!watchtime',  description: 'Total time the viewer has spent watching', defaultResponse: '',      dynamic: true  },
  { key: 'tip',        command: '!tip',        description: 'Shows the tip/donation link',              defaultResponse: '',      dynamic: false },
  { key: 'commands',   command: '!commands',   description: 'Lists available commands',                 defaultResponse: '',      dynamic: false },
] as const;

const AUTO_MOD_RULES = [
  'Filter links from non-subs',
  'Time out for caps lock > 70%',
  'Block emote spam (>10 in a row)',
  'Hold first-time messages for review',
];
const AUTO_MOD_DEFAULTS = [true, true, true, false];

function ChatRow({ m }: { m: ChatMessage }) {
  if (m.kind === 'bot') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, lineHeight: 1.5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, flexShrink: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'rgba(172,7,71,0.14)',
              border: '1px solid rgba(172,7,71,0.3)',
            }}
          >
            <MapleMark size={16} />
          </span>
          <span style={{ color: 'var(--maple-200)' }}>{m.user}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              background: 'var(--maple-500)',
              color: '#fff',
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '.1em',
              fontWeight: 700,
            }}
          >
            BOT
          </span>
        </span>
        <span style={{ color: 'var(--ink-1)' }}>{m.text}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14, lineHeight: 1.5 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {(m.badges ?? []).map(b => (
          <span
            key={b}
            style={{
              background: b === 'MOD' ? '#22C58B' : 'var(--maple-500)',
              color: b === 'MOD' ? '#053D31' : '#fff',
              fontSize: 9,
              padding: '1px 4px',
              borderRadius: 3,
              fontWeight: 700,
              letterSpacing: '.05em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {b}
          </span>
        ))}
        <span style={{ fontWeight: 600, color: m.color }}>{m.user}</span>
      </span>
      <span
        style={{
          color: m.mono ? '#F4BCD0' : 'var(--ink-1)',
          fontFamily: m.mono ? 'var(--font-mono)' : 'var(--font-body)',
          fontSize: m.mono ? 13 : 14,
        }}
      >
        {m.text}
      </span>
    </div>
  );
}

interface BotProps {
  live: boolean;
  onNav: (view: ViewId) => void;
  twitchUser: TwitchUser | null;
}

export default function Bot({ live, onNav: _onNav, twitchUser }: BotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [autoMod, setAutoMod] = useState<boolean[]>(AUTO_MOD_DEFAULTS);
  const [reconnecting, setReconnecting] = useState(false);
  const [commandTab, setCommandTab] = useState<'builtin' | 'custom'>('builtin');
  const [botStatus, setBotStatus] = useState<{ invited: boolean; active: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const apiUrl = import.meta.env.VITE_API_URL as string;

  const [commandConfigs, setCommandConfigs] = useState<Record<string, CmdCfg>>({
    ping: { enabled: true, response: 'pong!' },
    song: { enabled: true, response: '' },
  });
  const [editingCmd, setEditingCmd] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingCmd, setSavingCmd] = useState<string | null>(null);

  useEffect(() => {
    if (!twitchUser) { setStatusLoading(false); return; }

    const params = new URLSearchParams(window.location.search);
    if (params.get('invited') === 'true') {
      const returnedState = params.get('state');
      const expectedState = sessionStorage.getItem('bot_oauth_state');
      sessionStorage.removeItem('bot_oauth_state');
      if (returnedState && expectedState && returnedState === expectedState) {
        setBotStatus({ invited: true, active: false });
      }
      setStatusLoading(false);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    fetch(`${apiUrl}/bot/status?channel=${twitchUser.login}`)
      .then(r => r.json())
      .then(data => { setBotStatus(data); setStatusLoading(false); })
      .catch(() => setStatusLoading(false));
  }, [twitchUser?.login]);

  useEffect(() => {
    if (!twitchUser || !botStatus?.invited || botStatus.active) return;
    const interval = setInterval(() => {
      fetch(`${apiUrl}/bot/status?channel=${twitchUser.login}`)
        .then(r => r.json())
        .then(setBotStatus)
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [twitchUser?.login, botStatus?.invited, botStatus?.active]);

  useEffect(() => {
    if (!twitchUser) return;
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/commands`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Array<{ command: string; enabled: boolean; response: string | null; builtin?: boolean }>) => {
        setCommandConfigs(prev => {
          const next = { ...prev };
          for (const cfg of data) next[cfg.command] = { enabled: cfg.enabled, response: cfg.response ?? '', builtin: cfg.builtin ?? false };
          return next;
        });
      })
      .catch(() => {});
  }, [twitchUser?.login]);

  async function saveCommandConfig(key: string, patch: Partial<CmdCfg>) {
    if (!twitchUser) return;
    const token = getToken();
    if (!token) return;
    setSavingCmd(key);
    const updated = { ...(commandConfigs[key] ?? { enabled: true, response: '' }), ...patch };
    try {
      await fetch(`${apiUrl}/bot/commands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command: key, ...updated }),
      });
      setCommandConfigs(prev => ({ ...prev, [key]: updated }));
    } catch (err) {
      console.error('Failed to save command config:', err);
    } finally {
      setSavingCmd(null);
    }
  }

  async function commitEdit(key: string) {
    await saveCommandConfig(key, { response: editDraft });
    setEditingCmd(null);
  }

  const channelName = twitchUser?.login ?? 'your channel';

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [
      ...prev,
      { kind: 'bot', user: 'maple_bot', text: input },
    ]);
    setInput('');
  };

  const handleReconnect = async () => {
    if (!twitchUser) return;
    const token = getToken();
    if (!token) return;
    setReconnecting(true);
    try {
      const res = await fetch(`${apiUrl}/bot/reconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Reconnect failed: ${res.statusText}`);
    } catch (err) {
      console.error('Reconnect failed:', err);
    } finally {
      setReconnecting(false);
    }
  };

  const toggleAutoMod = (index: number) => {
    setAutoMod(prev => prev.map((val, i) => i === index ? !val : val));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: '-0.02em',
            margin: '8px 0 4px',
          }}
        >
          maple_bot is in chat.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Connected to <strong style={{ color: 'var(--ink-0)' }}>twitch.tv/{channelName}</strong>. 12,847 messages processed today.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        {/* Chat preview */}
        <Card padded={false} style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-1)',
            }}
          >
            <Icon name="bot" size={18} style={{ color: 'var(--maple-300)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink-0)' }}>Live chat</span>
            <LivePill live={live} viewers={live ? 1284 : undefined} />
            <div style={{ flex: 1 }} />
            <Button
              variant="ghost"
              size="sm"
              icon={reconnecting ? 'refresh' : 'refresh'}
              disabled={reconnecting}
              onClick={handleReconnect}
            >
              {reconnecting ? 'Reconnecting…' : 'Reconnect'}
            </Button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.map((m, i) => <ChatRow key={i} m={m} />)}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderTop: '1px solid var(--border-1)',
              background: 'var(--bg-1)',
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Send a message as maple_bot…"
              style={{
                flex: 1,
                background: 'var(--bg-2)',
                border: '1px solid var(--border-2)',
                borderRadius: 10,
                padding: '0 14px',
                height: 38,
                color: 'var(--ink-0)',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
            <Button variant="primary" size="sm" iconRight="chevron" onClick={sendMessage}>Send</Button>
          </div>
        </Card>

        {/* Connection + auto-mod */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <Eyebrow>Connection</Eyebrow>
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-1)',
                }}
              >
                <Icon name="twitch" size={18} style={{ color: 'var(--ink-1)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>maple_bot</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: botStatus?.active ? '#22C58B' : 'var(--ink-3)',
                    }}
                  >
                    {statusLoading
                      ? 'Checking...'
                      : !twitchUser
                      ? 'Sign in to invite the bot'
                      : !botStatus?.invited
                      ? 'Not in your channel'
                      : !botStatus.active
                      ? 'Joining your channel...'
                      : `Connected · twitch.tv/${twitchUser.login}`}
                  </div>
                </div>
                {!statusLoading && twitchUser && (
                  !botStatus?.invited
                    ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => { window.location.href = buildBotAuthUrl(); }}
                      >
                        Invite Bot
                      </Button>
                    )
                    : botStatus.active
                    ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={reconnecting ? 'refresh' : 'refresh'}
                        disabled={reconnecting}
                        onClick={handleReconnect}
                      >
                        {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                      </Button>
                    )
                    : null
                )}
              </div>
            </div>
          </Card>

          <Card>
            <Eyebrow>Auto-mod</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, fontSize: 13 }}>
              {AUTO_MOD_RULES.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle on={autoMod[i]!} onChange={() => toggleAutoMod(i)} />
                  <span style={{ color: 'var(--ink-1)' }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Commands */}
      <Card padded={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-1)' }}>
          <Icon name="bot" size={16} style={{ color: 'var(--maple-300)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink-0)' }}>Commands</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-1)', padding: 3, borderRadius: 8, border: '1px solid var(--border-1)' }}>
            {(['builtin', 'custom'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCommandTab(tab)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  background: commandTab === tab ? 'var(--bg-0)' : 'transparent',
                  color: commandTab === tab ? 'var(--ink-0)' : 'var(--ink-3)',
                  boxShadow: commandTab === tab ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {tab === 'builtin' ? 'Built-in' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {commandTab === 'builtin' ? (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BUILTIN_COMMANDS.map(cmd => {
              const cfg = commandConfigs[cmd.key] ?? { enabled: true, response: cmd.defaultResponse };
              const isEditing = editingCmd === cmd.key;
              const isSaving = savingCmd === cmd.key;
              const canEdit = !!twitchUser && !cmd.dynamic;
              return (
                <div
                  key={cmd.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-1)',
                    border: `1px solid ${isEditing ? 'var(--maple-500)' : 'var(--border-1)'}`,
                    transition: 'border-color .15s',
                    opacity: cfg.enabled ? 1 : 0.5,
                  }}
                >
                  <Toggle
                    on={cfg.enabled}
                    onChange={() => !isSaving && saveCommandConfig(cmd.key, { enabled: !cfg.enabled })}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--maple-200)', fontWeight: 700, minWidth: 68 }}>
                    {cmd.command}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>{cmd.description}</div>
                    {isEditing ? (
                      <input
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(cmd.key);
                          if (e.key === 'Escape') setEditingCmd(null);
                        }}
                        autoFocus
                        style={{
                          marginTop: 6,
                          width: '100%',
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border-2)',
                          borderRadius: 7,
                          padding: '4px 10px',
                          color: 'var(--ink-0)',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: cmd.dynamic ? 'var(--ink-3)' : 'var(--ink-2)', marginTop: 2 }}>
                        → {cmd.dynamic ? 'Dynamic (Last.fm)' : (cfg.response || cmd.defaultResponse)}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" variant="primary" onClick={() => commitEdit(cmd.key)} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCmd(null)}>Cancel</Button>
                    </div>
                  ) : canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingCmd(cmd.key); setEditDraft(cfg.response || cmd.defaultResponse); }}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '48px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--ink-3)' }}>
            <Icon name="bot" size={28} style={{ color: 'var(--border-2)' }} />
            <div style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>No custom commands yet</div>
            <div style={{ fontSize: 13 }}>Custom command creation coming soon.</div>
          </div>
        )}
      </Card>
    </div>
  );
}
