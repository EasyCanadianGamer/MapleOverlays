import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import { getToken } from '../lib/twitchAuth';

const apiUrl = import.meta.env.VITE_API_URL as string;

interface Counter {
  command: string;
  response: string;
  count: number;
}

export default function BotCounters() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [settingCmd, setSettingCmd] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/counters`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: Counter[]) => setCounters(data))
      .catch(() => setError('Failed to load counters'));
  }, []);

  async function updateCount(command: string, newCount: number): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/bot/counters/${command}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ count: newCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setCounters(cs => cs.map(c => c.command === command ? { ...c, count: newCount } : c));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      return false;
    }
  }

  async function confirmSet(command: string) {
    const n = parseInt(draftValue, 10);
    if (isNaN(n) || n < 0) { setError('Enter a valid non-negative number'); return; }
    const ok = await updateCount(command, n);
    if (ok) { setSettingCmd(null); setDraftValue(''); }
  }

  const highlightCount = (response: string) => {
    const safe = response
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return safe.replace(/\{count\}/g, '<mark style="background:rgba(193,47,93,.18);color:var(--maple-200);border-radius:3px;padding:0 3px">{count}</mark>');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Counters
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Commands using <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--maple-300)' }}>{'{count}'}</code> or <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--maple-300)' }}>{'{1.count}'}</code> — each use increments automatically.
        </div>
      </div>

      <Card style={{ padding: 22 }}>
        <Eyebrow style={{ marginBottom: 14 }}>Counter commands</Eyebrow>

        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {counters.map(c => (
            <div key={c.command} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 18px', background: 'var(--bg-1)',
              border: '1px solid var(--border-1)', borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink-0)' }}>!{c.command}</span>
                  <span
                    style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    dangerouslySetInnerHTML={{ __html: highlightCount(c.response) }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => updateCount(c.command, Math.max(0, c.count - 1))}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
                >−</button>

                <div style={{ minWidth: 52, textAlign: 'center' }}>
                  {settingCmd === c.command ? (
                    <input
                      autoFocus
                      value={draftValue}
                      onChange={e => setDraftValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmSet(c.command); if (e.key === 'Escape') { setSettingCmd(null); setDraftValue(''); } }}
                      style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, background: 'var(--bg-2)', border: '1px solid var(--maple-500)', borderRadius: 6, color: 'var(--ink-0)', padding: '2px 4px' }}
                    />
                  ) : (
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-0)', fontFamily: 'var(--font-mono)', lineHeight: 1, cursor: 'pointer' }}
                      onClick={() => { setSettingCmd(c.command); setDraftValue(String(c.count)); }}>
                      {c.count}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => updateCount(c.command, c.count + 1)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
                >+</button>

                {settingCmd === c.command ? (
                  <Button variant="primary" size="sm" onClick={() => confirmSet(c.command)}>Set</Button>
                ) : (
                  <button
                    onClick={() => updateCount(c.command, 0)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', marginLeft: 4 }}
                  >Reset</button>
                )}
              </div>
            </div>
          ))}

          {counters.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No counter commands yet. Add <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{'{count}'}</code> to any command response in the Commands page.
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <div style={{ marginBottom: 4, color: 'var(--ink-2)', fontWeight: 600 }}>Template variables</div>
          <div><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>{'{count}'}</code> — increments this command's counter on each use and shows the value</div>
          <div style={{ marginTop: 2 }}><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>{'{getcount deaths}'}</code> — reads another command's counter without incrementing</div>
          <div style={{ marginTop: 2 }}><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>{'{1.count}'}</code> — per-target counter — <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>!hug @alice</code> tracks alice's count separately from bob's</div>
        </div>
      </Card>
    </div>
  );
}
