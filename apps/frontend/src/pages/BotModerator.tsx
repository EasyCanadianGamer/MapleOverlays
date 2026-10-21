import { useState, useEffect } from 'react';
import { getToken } from '../lib/twitchAuth';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Toggle from '../components/ui/Toggle';

const AUTO_MOD_RULES = [
  { label: 'Filter links from non-subs',         defaultOn: true  },
  { label: 'Time out for caps lock > 70%',        defaultOn: true  },
  { label: 'Block emote spam (>10 in a row)',     defaultOn: true  },
  { label: 'Hold first-time messages for review', defaultOn: false },
];

const apiUrl = import.meta.env.VITE_API_URL as string;

export default function BotModerator() {
  const [autoMod, setAutoMod] = useState<boolean[]>(AUTO_MOD_RULES.map(r => r.defaultOn));

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/automod`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.automod_settings) setAutoMod(data.automod_settings); })
      .catch(() => {});
  }, []);

  const toggleRule = (index: number) => {
    const next = autoMod.map((v, j) => j === index ? !v : v);
    setAutoMod(next);
    const token = getToken();
    if (!token) return;
    fetch(`${apiUrl}/bot/automod`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ automod_settings: next }),
    }).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Moderator.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Automated chat moderation rules for your channel.
        </div>
      </div>

      <Card>
        <Eyebrow>Auto-mod</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 12 }}>
          {AUTO_MOD_RULES.map((rule, i) => (
            <div
              key={rule.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: i < AUTO_MOD_RULES.length - 1 ? '1px solid var(--border-1)' : 'none',
              }}
            >
              <Toggle on={autoMod[i]!} onChange={() => toggleRule(i)} />
              <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{rule.label}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 16 }}>
          Rules 1–3 require the bot to be a channel moderator. Type <code>/mod [botname]</code> in your Twitch chat to enable enforcement.
        </p>
      </Card>
    </div>
  );
}
