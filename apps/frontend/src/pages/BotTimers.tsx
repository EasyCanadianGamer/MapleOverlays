import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import Icon from '../components/ui/Icon';
import { getToken } from '../lib/twitchAuth';

const apiUrl = import.meta.env.VITE_API_URL as string;

interface Timer {
  id: number;
  name: string;
  message: string;
  online_interval: number;
  offline_interval: number;
  chat_lines: number;
  enabled: boolean;
  last_fired_at: string | null;
}

interface TimerDraft {
  name: string;
  message: string;
  online_interval: string;
  offline_interval: string;
  chat_lines: string;
  enabled: boolean;
}

const emptyDraft = (): TimerDraft => ({
  name: '', message: '',
  online_interval: '15', offline_interval: '0', chat_lines: '0',
  enabled: true,
});

function secsToMins(secs: number): string {
  return secs === 0 ? '0' : String(Math.round(secs / 60));
}

function minsToSecs(mins: string): number {
  const n = parseInt(mins, 10);
  return isNaN(n) || n < 0 ? 0 : n * 60;
}

export default function BotTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<TimerDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/timers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Timer[]) => setTimers(data))
      .catch(() => setError('Failed to load timers'));
  }, []);

  function startEdit(t: Timer) {
    setDraft({
      name: t.name,
      message: t.message,
      online_interval: secsToMins(t.online_interval),
      offline_interval: secsToMins(t.offline_interval),
      chat_lines: String(t.chat_lines),
      enabled: t.enabled,
    });
    setEditingId(t.id);
  }

  function startCreate() {
    setDraft(emptyDraft());
    setEditingId('new');
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveTimer() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    const body = {
      name: draft.name.trim(),
      message: draft.message.trim(),
      online_interval: minsToSecs(draft.online_interval),
      offline_interval: minsToSecs(draft.offline_interval),
      chat_lines: Math.max(0, parseInt(draft.chat_lines, 10) || 0),
      enabled: draft.enabled,
    };
    try {
      const url = editingId === 'new'
        ? `${apiUrl}/bot/timers`
        : `${apiUrl}/bot/timers/${editingId}`;
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const saved: Timer = data;
      if (editingId === 'new') {
        setTimers(ts => [...ts, saved]);
      } else {
        setTimers(ts => ts.map(t => t.id === saved.id ? saved : t));
      }
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(timer: Timer) {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/bot/timers/${timer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !timer.enabled }),
      });
      if (!res.ok) { setError('Failed to update timer'); return; }
      const updated: Timer = await res.json();
      setTimers(ts => ts.map(t => t.id === updated.id ? updated : t));
    } catch { setError('Failed to update timer'); }
  }

  async function deleteTimer(id: number) {
    if (!confirm('Delete this timer?')) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/bot/timers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('Failed to delete timer'); return; }
      setTimers(ts => ts.filter(t => t.id !== id));
      if (editingId === id) setEditingId(null);
    } catch { setError('Failed to delete timer'); }
  }

  const field = (label: string, key: keyof TimerDraft, placeholder = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      <input
        value={draft[key] as string}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          height: 36, padding: '0 12px', borderRadius: 8,
          background: 'var(--bg-1)', border: '1px solid var(--border-2)',
          color: 'var(--ink-0)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
        }}
      />
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Timers
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Auto-post announcements, social links, or reminders on a schedule.
        </div>
      </div>

      <Card style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Eyebrow>Active timers</Eyebrow>
          {editingId !== 'new' && (
            <Button variant="secondary" size="sm" onClick={startCreate}>+ New Timer</Button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timers.map(t => (
            <div key={t.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--bg-1)',
                border: `1px solid ${editingId === t.id ? 'var(--maple-500)' : 'var(--border-1)'}`,
                borderRadius: 12, opacity: t.enabled ? 1 : 0.55,
              }}>
                <Toggle on={t.enabled} onChange={() => toggleEnabled(t)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.message}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--maple-400)', fontWeight: 600 }}>
                      {t.online_interval === 0 ? '—' : `${Math.round(t.online_interval / 60)}m`}
                    </span>
                    {' '}online
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: t.offline_interval === 0 ? 'var(--ink-4)' : 'var(--ink-2)', fontWeight: 600 }}>
                      {t.offline_interval === 0 ? 'off' : `${Math.round(t.offline_interval / 60)}m`}
                    </span>
                    {' '}offline
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{t.chat_lines}</span>
                    {' '}lines
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button variant="secondary" size="sm" onClick={() => editingId === t.id ? cancelEdit() : startEdit(t)}>
                    {editingId === t.id ? 'Cancel' : 'Edit'}
                  </Button>
                  <button
                    onClick={() => deleteTimer(t.id)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
                  >
                    <Icon name="trash-2" size={13} />
                  </button>
                </div>
              </div>

              {editingId === t.id && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-0)', border: '1px solid var(--maple-500)', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {field('Name', 'name')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {field('Online (min)', 'online_interval', '15')}
                      {field('Offline (min)', 'offline_interval', '0')}
                      {field('Chat lines', 'chat_lines', '5')}
                    </div>
                  </div>
                  {field('Message', 'message', 'Check out our Discord at discord.gg/...')}
                  {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={saveTimer} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editingId === 'new' && (
            <div style={{ padding: '14px 16px', background: 'var(--bg-1)', border: '1px solid var(--maple-500)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--maple-400)', fontWeight: 600, marginBottom: 12 }}>New timer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {field('Name', 'name', 'Social Links')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {field('Online (min)', 'online_interval', '15')}
                  {field('Offline (min)', 'offline_interval', '0')}
                  {field('Chat lines', 'chat_lines', '5')}
                </div>
              </div>
              {field('Message', 'message', 'Follow us on Twitter @...')}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                Offline interval 0 = timer won't post when stream is offline. Chat lines = min messages since last post.
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={saveTimer} disabled={saving}>
                  {saving ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {timers.length === 0 && editingId !== 'new' && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No timers yet. Create one to auto-post messages on a schedule.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
