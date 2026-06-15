import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { useTwitchAuth } from '../hooks/useTwitchAuth';
import { getToken } from '../lib/twitchAuth';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}

function Field({ label, value, onChange, mono = false, placeholder }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 40, padding: '0 14px', borderRadius: 10,
          background: 'var(--bg-1)', border: '1px solid var(--border-2)',
          color: 'var(--ink-0)', outline: 'none',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)', fontSize: 14,
        }}
      />
    </label>
  );
}

const apiUrl = import.meta.env.VITE_API_URL as string;

export default function Settings() {
  const [lastfmUsername, setLastfmUsername] = useState('');
  const [tipUrl, setTipUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { connected, user, connect, disconnect } = useTwitchAuth();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: { lastfm_username: string; tip_url: string }) => {
        setLastfmUsername(data.lastfm_username ?? '');
        setTipUrl(data.tip_url ?? '');
      })
      .catch(() => setSaveError('Failed to load settings'));
  }, [connected]);

  const saveSettings = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lastfm_username: lastfmUsername, tip_url: tipUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Connect your channel.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          One account to connect for the MVP — Twitch. More platforms later.
        </div>
      </div>

      {/* Channel connection */}
      <Card style={{ padding: 22 }}>
        <Eyebrow>Channel connection</Eyebrow>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(169,112,255,.14)', border: '1px solid rgba(169,112,255,.32)', display: 'grid', placeItems: 'center', color: '#A970FF' }}>
            <Icon name="twitch" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)' }}>Twitch</div>
            {connected && user ? (
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#22C58B', marginTop: 2 }}>● Connected · twitch.tv/{user.login}</div>
            ) : (
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginTop: 2 }}>○ Not connected</div>
            )}
          </div>
          {connected
            ? <Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>
            : <Button variant="primary"   size="sm" onClick={connect}>Connect</Button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {[{ icon: 'youtube', name: 'YouTube' }, { icon: 'discord', name: 'Discord' }].map(({ icon, name }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, opacity: 0.55, background: 'var(--bg-1)', border: '1px dashed var(--border-2)' }}>
              <Icon name={icon} size={18} style={{ color: 'var(--ink-3)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{name}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>Coming later</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Integrations */}
      <Card style={{ padding: 22 }}>
        <Eyebrow>Integrations</Eyebrow>

        {/* Last.fm */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(198,32,49,.12)', border: '1px solid rgba(198,32,49,.28)', display: 'grid', placeItems: 'center', color: '#C62031' }}>
            <Icon name="music" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)' }}>Last.fm</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              Powers the <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>!song</span> command.
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Last.fm username" value={lastfmUsername} onChange={setLastfmUsername} mono />
            </div>
          </div>
        </div>

        {/* Tip link */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(255,182,39,.1)', border: '1px solid rgba(255,182,39,.28)', display: 'grid', placeItems: 'center', color: '#FFB627' }}>
            <Icon name="heart" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)' }}>Tip link</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              Shown when viewers type <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>!tip</span> in chat.
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Tip URL" value={tipUrl} onChange={setTipUrl} placeholder="https://streamelements.com/yourname/tip" />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant={saved ? 'success' : 'secondary'} size="sm" onClick={saveSettings} disabled={saving || !connected}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {saveError && (
          <div style={{ fontSize: 12, color: '#e05252', marginTop: 6, textAlign: 'right' }}>{saveError}</div>
        )}
      </Card>

      {/* Self-host quickstart */}
      <Card style={{ padding: 22 }}>
        <Eyebrow>Self-host quickstart</Eyebrow>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>MapleOverlays is open source. Run the whole stack on your own box.</div>
        <div style={{ marginTop: 12, padding: 18, background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 12, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7 }}>
          <div><span style={{ color: 'var(--ink-3)' }}>$</span> <span style={{ color: 'var(--ink-0)' }}>git clone</span> <span style={{ color: '#4ED4B5' }}>https://github.com/EasyCanadianGamer/MapleOverlays</span></div>
          <div><span style={{ color: 'var(--ink-3)' }}>$</span> <span style={{ color: 'var(--ink-0)' }}>cd</span> MapleOverlays</div>
          <div><span style={{ color: 'var(--ink-3)' }}>$</span> <span style={{ color: 'var(--ink-0)' }}>cp</span> .env.example .env <span style={{ color: 'var(--ink-3)' }}># add your TWITCH_CLIENT_ID</span></div>
          <div><span style={{ color: 'var(--ink-3)' }}>$</span> <span style={{ color: 'var(--ink-0)' }}>docker compose up --build</span></div>
          <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>→ http://localhost:3000</div>
        </div>
      </Card>
    </div>
  );
}
