import { useState, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Sidebar, { type ViewId } from './Sidebar';
import StreamManager from '../../pages/StreamManager';
import Overlays from '../../pages/Overlays';
import BotCommands from '../../pages/BotCommands';
import BotSettings from '../../pages/BotSettings';
import BotModerator from '../../pages/BotModerator';
import BotTimers from '../../pages/BotTimers';
import BotCounters from '../../pages/BotCounters';
import Settings from '../../pages/Settings';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';
import { useTwitchStats } from '../../hooks/useTwitchStats';
import { useStreamInfo } from '../../hooks/useStreamInfo';

interface FlashState {
  user: string;
  kind: string;
  at: number;
}

function pathnameToView(pathname: string): ViewId {
  if (pathname.startsWith('/dashboard/overlays'))     return 'overlays';
  if (pathname.startsWith('/dashboard/bot/commands')) return 'bot-commands';
  if (pathname.startsWith('/dashboard/bot/settings')) return 'bot-settings';
  if (pathname.startsWith('/dashboard/bot/mod'))      return 'bot-moderator';
  if (pathname.startsWith('/dashboard/bot/timers'))   return 'bot-timers';
  if (pathname.startsWith('/dashboard/bot/counters')) return 'bot-counters';
  if (pathname.startsWith('/dashboard/settings'))     return 'settings';
  return 'manager';
}

function viewToPath(view: ViewId): string {
  switch (view) {
    case 'overlays':      return '/dashboard/overlays';
    case 'bot-commands':  return '/dashboard/bot/commands';
    case 'bot-settings':  return '/dashboard/bot/settings';
    case 'bot-moderator': return '/dashboard/bot/mod';
    case 'bot-timers':    return '/dashboard/bot/timers';
    case 'bot-counters':  return '/dashboard/bot/counters';
    case 'settings':      return '/dashboard/settings';
    default:              return '/dashboard';
  }
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = pathnameToView(location.pathname);
  const [flash, setFlash] = useState<FlashState | null>(null);

  const { connected: twitchConnected, user: twitchUser, disconnect: logoutTwitch } = useTwitchAuth();
  const { stats, loading: statsLoading, refresh: refreshStats } = useTwitchStats(twitchUser);
  const { info: streamInfo, loading: infoLoading, saving: infoSaving, error: infoError, save: saveStreamInfo } = useStreamInfo(twitchUser);

  const live      = stats?.isLive ?? false;
  const liveStart = useMemo(
    () => stats?.startedAt ? new Date(stats.startedAt).getTime() : null,
    [stats?.startedAt],
  );

  if (!twitchConnected) return <Navigate to="/login" replace />;

  const fireTestAlert = () => {
    setFlash({ user: '@ratking_99', kind: 'subscribed!', at: Date.now() });
    setTimeout(() => setFlash(null), 3200);
  };

  const views: Record<ViewId, ReactNode> = {
    manager: (
      <StreamManager
        live={live}
        liveStart={liveStart}
        onRefresh={refreshStats}
        twitchUser={twitchUser}
        stats={stats}
        statsLoading={statsLoading}
        streamInfo={streamInfo}
        infoLoading={infoLoading}
        infoSaving={infoSaving}
        infoError={infoError}
        onSaveStreamInfo={saveStreamInfo}
        onTestAlert={fireTestAlert}
        onNav={v => navigate(viewToPath(v))}
      />
    ),
    overlays:       <Overlays />,
    'bot-commands': <BotCommands twitchUser={twitchUser} />,
    'bot-settings': <BotSettings twitchUser={twitchUser} />,
    'bot-moderator': <BotModerator />,
    'bot-timers':    <BotTimers />,
    'bot-counters':  <BotCounters />,
    settings:       <Settings />,
  };

  return (
    <div className="dashboard-body" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar view={view} onNav={v => navigate(viewToPath(v))} twitchUser={twitchUser} onLogout={logoutTwitch} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1, overflowY: 'auto' }}>
        <main style={{ padding: 28, flex: 1 }}>
          {views[view]}
        </main>
      </div>

      {flash && (
        <div className="alert-flash" key={flash.at}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              background: 'rgba(40,28,20,.94)',
              backdropFilter: 'blur(12px)',
              borderRadius: 16,
              border: '1px solid rgba(193,47,93,.4)',
              boxShadow: '0 24px 60px -20px rgba(172,7,71,.6), 0 0 0 1px rgba(255,255,255,.06) inset',
              minWidth: 380,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--maple-500)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: '#FFB627',
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                New subscriber
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: '-0.015em',
                  marginTop: 2,
                }}
              >
                <span style={{ color: 'var(--maple-200)' }}>{flash.user}</span> {flash.kind}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
