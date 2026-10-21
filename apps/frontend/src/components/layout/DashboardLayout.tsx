import { useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Sidebar, { type ViewId } from './Sidebar';
import StreamManager from '../../pages/StreamManager';
import OverlaysArea from '../../pages/OverlaysArea';
import BotCommands from '../../pages/BotCommands';
import BotSettings from '../../pages/BotSettings';
import BotModerator from '../../pages/BotModerator';
import BotTimers from '../../pages/BotTimers';
import BotCounters from '../../pages/BotCounters';
import Settings from '../../pages/Settings';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';
import { useTwitchStats } from '../../hooks/useTwitchStats';
import { useStreamInfo } from '../../hooks/useStreamInfo';

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

  const { connected: twitchConnected, user: twitchUser, disconnect: logoutTwitch } = useTwitchAuth();
  const { stats, loading: statsLoading, refresh: refreshStats } = useTwitchStats(twitchUser);
  const { info: streamInfo, loading: infoLoading, saving: infoSaving, error: infoError, save: saveStreamInfo } = useStreamInfo(twitchUser);

  const live      = stats?.isLive ?? false;
  const liveStart = useMemo(
    () => stats?.startedAt ? new Date(stats.startedAt).getTime() : null,
    [stats?.startedAt],
  );

  if (!twitchConnected) return <Navigate to="/login" replace />;

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
        onNav={v => navigate(viewToPath(v))}
      />
    ),
    overlays:       <OverlaysArea />,
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
    </div>
  );
}
