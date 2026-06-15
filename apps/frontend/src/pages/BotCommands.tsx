import { useState, useEffect, useRef } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import Icon from '../components/ui/Icon';
import type { TwitchUser } from '../lib/twitchAuth';
import { getToken } from '../lib/twitchAuth';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILTIN_COMMANDS = [
  { key: 'ping',       command: '!ping',       description: 'Checks if the bot is alive',           defaultResponse: 'pong!', dynamic: false },
  { key: 'song',       command: '!song',       description: 'Currently playing track via Last.fm',  defaultResponse: '',      dynamic: true  },
  { key: 'uptime',     command: '!uptime',     description: 'How long the stream has been live',    defaultResponse: '',      dynamic: false },
  { key: 'downtime',   command: '!downtime',   description: 'How long the stream has been offline', defaultResponse: '',      dynamic: false },
  { key: 'followage',  command: '!followage',  description: 'How long you\'ve been following',      defaultResponse: '',      dynamic: false },
  { key: 'accountage', command: '!accountage', description: 'How old your Twitch account is',       defaultResponse: '',      dynamic: false },
  { key: 'watchtime',  command: '!watchtime',  description: 'Your total watchtime in this channel', defaultResponse: '',      dynamic: false },
  { key: 'tip',        command: '!tip',        description: 'Link to support the streamer',         defaultResponse: '',      dynamic: false },
  { key: 'commands',   command: '!commands',   description: 'Link to the command list page',        defaultResponse: '',      dynamic: false },
] as const;

const BUILTIN_KEYS = new Set<string>(BUILTIN_COMMANDS.map(c => c.key));
const CMD_NAME_RE  = /^[a-z0-9_]{1,20}$/;

const TEMPLATE_VARS = [
  { key: '{user}',             hint: "Chatter's username (who typed the command)" },
  { key: '{channel}',          hint: "Broadcaster's channel name" },
  { key: '{1}',                hint: 'First argument — e.g. !hug @ratking → ratking' },
  { key: '{game}',             hint: 'Game currently being streamed' },
  { key: '{channel.viewers}',  hint: 'Current viewer count' },
  { key: '{1.game}',           hint: "Game the mentioned user is currently playing" },
  { key: '{user.follow}',      hint: 'How long the chatter has been following' },
  { key: '{user.subscribe}',   hint: "Chatter's subscription tier (if subscribed)" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertAtCursor(inputEl: HTMLInputElement, text: string, setter: (v: string) => void) {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end   = inputEl.selectionEnd   ?? inputEl.value.length;
  const next  = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
  setter(next);
  requestAnimationFrame(() => {
    inputEl.focus();
    inputEl.setSelectionRange(start + text.length, start + text.length);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VarChips({ inputRef, setter }: { inputRef: React.RefObject<HTMLInputElement | null>; setter: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {TEMPLATE_VARS.map(v => (
        <button
          key={v.key}
          title={v.hint}
          type="button"
          onClick={() => inputRef.current && insertAtCursor(inputRef.current, v.key, setter)}
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            border: '1px solid var(--border-2)',
            background: 'var(--bg-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--maple-200)',
            cursor: 'pointer',
          }}
        >
          {v.key}
        </button>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type CmdCfg = { enabled: boolean; response: string };
type CustomCmd = { command: string; enabled: boolean; response: string };

// ── Main component ────────────────────────────────────────────────────────────

interface BotCommandsProps {
  twitchUser: TwitchUser | null;
}

export default function BotCommands({ twitchUser }: BotCommandsProps) {
  const apiUrl = import.meta.env.VITE_API_URL as string;

  // Built-in command state
  const [commandConfigs, setCommandConfigs] = useState<Record<string, CmdCfg>>(() =>
    Object.fromEntries(BUILTIN_COMMANDS.map(c => [c.key, { enabled: true, response: c.defaultResponse }]))
  );

  // Custom command state
  const [customCommands, setCustomCommands] = useState<CustomCmd[]>([]);

  // Tab / edit state
  const [commandTab, setCommandTab] = useState<'builtin' | 'custom'>('builtin');
  const [editingCmd, setEditingCmd]   = useState<string | null>(null);
  const [editDraft, setEditDraft]     = useState('');
  const [savingCmd, setSavingCmd]     = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // New command form state
  const [isCreating, setIsCreating]   = useState(false);
  const [newName, setNewName]         = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newSaving, setNewSaving]     = useState(false);
  const [newError, setNewError]       = useState<string | null>(null);
  const newResponseRef = useRef<HTMLInputElement>(null);

  // Load from API
  useEffect(() => {
    const token = getToken();
    if (!twitchUser || !token) return;
    fetch(`${apiUrl}/bot/commands`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Array<{ command: string; enabled: boolean; response: string | null; builtin: boolean }>) => {
        setCommandConfigs(prev => {
          const next = { ...prev };
          for (const cfg of data.filter(d => d.builtin)) {
            next[cfg.command] = { enabled: cfg.enabled, response: cfg.response ?? '' };
          }
          return next;
        });
        setCustomCommands(
          data
            .filter(d => !d.builtin)
            .map(d => ({ command: d.command, enabled: d.enabled, response: d.response ?? '' }))
        );
      })
      .catch(() => {});
  }, [twitchUser?.login]);

  // ── Built-in command actions ──────────────────────────────────────────────

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
    } finally {
      setSavingCmd(null);
    }
  }

  async function commitEdit(key: string) {
    await saveCommandConfig(key, { response: editDraft });
    setEditingCmd(null);
  }

  // ── Custom command actions ────────────────────────────────────────────────

  async function createCommand() {
    const name = newName.trim().toLowerCase();
    if (!CMD_NAME_RE.test(name)) {
      setNewError('Name must be 1–20 lowercase letters, digits, or underscores');
      return;
    }
    if (BUILTIN_KEYS.has(name)) {
      setNewError('That name is reserved for a built-in command');
      return;
    }
    if (!newResponse.trim()) {
      setNewError('Response cannot be empty');
      return;
    }
    setNewSaving(true);
    setNewError(null);
    const token = getToken();
    try {
      const res = await fetch(`${apiUrl}/bot/commands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command: name, enabled: true, response: newResponse.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setNewError(body.error ?? 'Failed to save');
        return;
      }
      setCustomCommands(prev => {
        const existing = prev.findIndex(c => c.command === name);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { command: name, enabled: true, response: newResponse.trim() };
          return next;
        }
        return [...prev, { command: name, enabled: true, response: newResponse.trim() }];
      });
      setIsCreating(false);
      setNewName('');
      setNewResponse('');
    } finally {
      setNewSaving(false);
    }
  }

  async function toggleCustom(command: string, enabled: boolean) {
    const token = getToken();
    if (!token) return;
    const cmd = customCommands.find(c => c.command === command);
    if (!cmd) return;
    await fetch(`${apiUrl}/bot/commands`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ command, enabled, response: cmd.response }),
    });
    setCustomCommands(prev => prev.map(c => c.command === command ? { ...c, enabled } : c));
  }

  async function saveCustomEdit(command: string) {
    const token = getToken();
    if (!token) return;
    const cmd = customCommands.find(c => c.command === command);
    if (!cmd) return;
    setSavingCmd(command);
    try {
      await fetch(`${apiUrl}/bot/commands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command, enabled: cmd.enabled, response: editDraft }),
      });
      setCustomCommands(prev => prev.map(c => c.command === command ? { ...c, response: editDraft } : c));
      setEditingCmd(null);
    } finally {
      setSavingCmd(null);
    }
  }

  async function deleteCommand(command: string) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${apiUrl}/bot/commands/${encodeURIComponent(command)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setCustomCommands(prev => prev.filter(c => c.command !== command));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const cmdRowStyle = (active: boolean, editing: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '10px 14px', borderRadius: 10,
    background: 'var(--bg-1)',
    border: `1px solid ${editing ? 'var(--maple-500)' : 'var(--border-1)'}`,
    transition: 'border-color .15s',
    opacity: active ? 1 : 0.5,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Commands.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Manage what maple_bot responds to in chat.
        </div>
      </div>

      <Card padded={false}>
        {/* Tab header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-1)' }}>
          <Icon name="terminal" size={16} style={{ color: 'var(--maple-300)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink-0)' }}>Commands</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-1)', padding: 3, borderRadius: 8, border: '1px solid var(--border-1)' }}>
            {(['builtin', 'custom'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCommandTab(tab)}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                  background: commandTab === tab ? 'var(--bg-0)' : 'transparent',
                  color: commandTab === tab ? 'var(--ink-0)' : 'var(--ink-3)',
                  boxShadow: commandTab === tab ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {tab === 'builtin' ? 'Built-in' : `Custom${customCommands.length > 0 ? ` (${customCommands.length})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {/* ── Built-in tab ── */}
        {commandTab === 'builtin' && (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BUILTIN_COMMANDS.map(cmd => {
              const cfg = commandConfigs[cmd.key] ?? { enabled: true, response: cmd.defaultResponse };
              const isEditing = editingCmd === cmd.key;
              const isSaving  = savingCmd  === cmd.key;
              const canEdit   = !!twitchUser && !cmd.dynamic;
              return (
                <div key={cmd.key} style={cmdRowStyle(cfg.enabled, isEditing)}>
                  <Toggle
                    on={cfg.enabled}
                    onChange={() => !isSaving && saveCommandConfig(cmd.key, { enabled: !cfg.enabled })}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--maple-200)', fontWeight: 700, minWidth: 80 }}>
                    {cmd.command}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>{cmd.description}</div>
                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void commitEdit(cmd.key);
                            if (e.key === 'Escape') setEditingCmd(null);
                          }}
                          autoFocus
                          style={{
                            marginTop: 6, width: '100%',
                            background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                            borderRadius: 7, padding: '4px 10px',
                            color: 'var(--ink-0)', fontSize: 12,
                            fontFamily: 'var(--font-mono)', outline: 'none',
                          }}
                        />
                        <VarChips inputRef={editInputRef} setter={setEditDraft} />
                      </>
                    ) : (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: cmd.dynamic ? 'var(--ink-3)' : 'var(--ink-2)', marginTop: 2 }}>
                        → {cmd.dynamic ? 'Dynamic (auto)' : (cfg.response || cmd.defaultResponse)}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" variant="primary" onClick={() => void commitEdit(cmd.key)} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCmd(null)}>Cancel</Button>
                    </div>
                  ) : canEdit ? (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setEditingCmd(cmd.key); setEditDraft(cfg.response || cmd.defaultResponse); }}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Custom tab ── */}
        {commandTab === 'custom' && (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* New command form */}
            {isCreating ? (
              <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--maple-500)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--maple-300)', lineHeight: '36px', flexShrink: 0 }}>!</span>
                  <input
                    value={newName}
                    onChange={e => { setNewName(e.target.value.toLowerCase()); setNewError(null); }}
                    placeholder="command"
                    maxLength={20}
                    autoFocus
                    style={{
                      width: 120, height: 36, padding: '0 10px', borderRadius: 8,
                      background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                      color: 'var(--ink-0)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                    }}
                  />
                  <input
                    ref={newResponseRef}
                    value={newResponse}
                    onChange={e => { setNewResponse(e.target.value); setNewError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') void createCommand(); if (e.key === 'Escape') setIsCreating(false); }}
                    placeholder='Response… use {user}, {1}, {game}, etc.'
                    style={{
                      flex: 1, height: 36, padding: '0 10px', borderRadius: 8,
                      background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                      color: 'var(--ink-0)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                    }}
                  />
                  <Button size="sm" variant="primary" onClick={() => void createCommand()} disabled={newSaving} style={{ flexShrink: 0 }}>
                    {newSaving ? 'Saving…' : 'Add'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsCreating(false); setNewName(''); setNewResponse(''); setNewError(null); }} style={{ flexShrink: 0 }}>
                    Cancel
                  </Button>
                </div>
                <VarChips inputRef={newResponseRef} setter={setNewResponse} />
                {newError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#F4526A', fontFamily: 'var(--font-mono)' }}>{newError}</div>
                )}
              </div>
            ) : (
              <Button
                variant="primary" size="sm" icon="plus"
                onClick={() => { setIsCreating(true); setNewName(''); setNewResponse(''); setNewError(null); }}
                style={{ alignSelf: 'flex-start' }}
              >
                New command
              </Button>
            )}

            {/* Custom command list */}
            {customCommands.length === 0 && !isCreating && (
              <div style={{ padding: '36px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--ink-3)' }}>
                <Icon name="terminal" size={28} style={{ color: 'var(--border-2)' }} />
                <div style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>No custom commands yet</div>
                <div style={{ fontSize: 13 }}>Click "New command" above to create your first one.</div>
              </div>
            )}

            {customCommands.map(cmd => {
              const isEditing = editingCmd === cmd.command;
              const isSaving  = savingCmd  === cmd.command;
              return (
                <div key={cmd.command} style={cmdRowStyle(cmd.enabled, isEditing)}>
                  <Toggle
                    on={cmd.enabled}
                    onChange={() => void toggleCustom(cmd.command, !cmd.enabled)}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--maple-200)', fontWeight: 700, minWidth: 80 }}>
                    !{cmd.command}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveCustomEdit(cmd.command);
                            if (e.key === 'Escape') setEditingCmd(null);
                          }}
                          autoFocus
                          style={{
                            width: '100%',
                            background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                            borderRadius: 7, padding: '4px 10px',
                            color: 'var(--ink-0)', fontSize: 12,
                            fontFamily: 'var(--font-mono)', outline: 'none',
                          }}
                        />
                        <VarChips inputRef={editInputRef} setter={setEditDraft} />
                      </>
                    ) : (
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        → {cmd.response}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" variant="primary" onClick={() => void saveCustomEdit(cmd.command)} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCmd(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setEditingCmd(cmd.command); setEditDraft(cmd.response); }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        icon="trash"
                        onClick={() => void deleteCommand(cmd.command)}
                        style={{ color: '#F4526A' }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Variable reference */}
            {(customCommands.length > 0 || isCreating) && (
              <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-0)', border: '1px solid var(--border-1)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Available variables
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {TEMPLATE_VARS.map(v => (
                    <div key={v.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--maple-200)', minWidth: 140 }}>{v.key}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{v.hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
