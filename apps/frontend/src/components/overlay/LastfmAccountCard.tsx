import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Eyebrow from '../ui/Eyebrow';
import { apiUrl } from '../../lib/overlayApi';
import { getToken } from '../../lib/twitchAuth';

export default function LastfmAccountCard() {
  const [username, setUsername] = useState('');
  const [tipUrl, setTipUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        // A failed load must not enable Save: saving empty fields would wipe the stored username and tip link.
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json() as { lastfm_username?: string; tip_url?: string };
      })
      .then(d => {
        setUsername(d.lastfm_username ?? '');
        setTipUrl(d.tip_url ?? '');
        setLoaded(true);
      })
      .catch(() => setError('Could not load your Last.fm username.'));
  }, []);

  const save = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lastfm_username: username, tip_url: tipUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setMessage('Saved');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ padding: 22 }}>
      <Eyebrow>Account</Eyebrow>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>Last.fm username</span>
          <input
            value={username} onChange={e => setUsername(e.target.value)} disabled={!loaded} maxLength={64}
            style={{ height: 36, padding: '0 12px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border-2)', color: 'var(--ink-0)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 14 }}
          />
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Shared by all your Now Playing overlays. Last.fm is the only music source: turn on scrobbling in your music app (Spotify: last.fm → Settings → Applications).
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button variant={message ? 'success' : 'secondary'} size="sm" onClick={save} disabled={!loaded || saving}>
            {message ? 'Saved!' : saving ? 'Saving…' : 'Save username'}
          </Button>
          {error && <span style={{ fontSize: 12, color: '#e05252' }}>{error}</span>}
        </div>
      </div>
    </Card>
  );
}
