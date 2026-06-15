import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import type { TwitchUser } from '../lib/twitchAuth';
import { buildBotAuthUrl } from '../lib/twitchAuth';

interface BotSettingsProps {
  twitchUser: TwitchUser | null;
}

export default function BotSettings({ twitchUser }: BotSettingsProps) {
  const [botStatus, setBotStatus] = useState<{ invited: boolean; active: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL as string;

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

  const handleReconnect = () => {
    setReconnecting(true);
    setTimeout(() => setReconnecting(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Eyebrow>Bot</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Bot settings.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          Manage how maple_bot connects to your channel.
        </div>
      </div>

      <Card>
        <Eyebrow>Connection</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--bg-1)', border: '1px solid var(--border-1)',
          }}>
            <Icon name="twitch" size={18} style={{ color: 'var(--ink-1)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>maple_bot</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: botStatus?.active ? '#22C58B' : 'var(--ink-3)' }}>
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
              !botStatus?.invited ? (
                <Button size="sm" variant="primary" onClick={() => { window.location.href = buildBotAuthUrl(); }}>
                  Invite Bot
                </Button>
              ) : botStatus.active ? (
                <Button variant="ghost" size="sm" disabled={reconnecting} onClick={handleReconnect}>
                  {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                </Button>
              ) : null
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
