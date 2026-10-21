import { useState, useEffect, useRef, type ReactNode } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import LivePill from '../components/ui/LivePill';
import type { TwitchUser } from '../lib/twitchAuth';
import { getToken } from '../lib/twitchAuth';
import type { ChannelStats, StreamInfo, TwitchCategory } from '../lib/twitchApi';
import { searchCategories } from '../lib/twitchApi';

type ViewId = 'manager' | 'overlays' | 'bot-commands' | 'bot-settings' | 'bot-moderator' | 'settings';

interface StatBoxProps {
  label: string;
  value: string;
  sub: ReactNode;
  icon: string;
  accent?: string;
}

function StatBox({ label, value, sub, icon, accent }: StatBoxProps) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)' }}>
        <Icon name={icon} size={14} />
        <Eyebrow style={{ color: 'var(--ink-3)' }}>{label}</Eyebrow>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: '-0.02em',
          marginTop: 6,
          lineHeight: 1,
          color: accent ?? 'var(--ink-0)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6 }}>{sub}</div>
    </Card>
  );
}

interface HubCardProps {
  icon: string;
  title: string;
  desc: string;
  status: string;
  accent: string;
  onClick: () => void;
}

function HubCard({ icon, title, desc, status, accent, onClick }: HubCardProps) {
  return (
    <Card className="hub-card" padded={false} onClick={onClick} style={{ padding: 18, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: `${accent}1f`,
            border: `1px solid ${accent}55`,
            display: 'grid',
            placeItems: 'center',
            color: accent,
          }}
        >
          <Icon name={icon} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '-0.01em',
                flex: 1,
                color: 'var(--ink-0)',
              }}
            >
              {title}
            </span>
            <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
          <div
            style={{
              marginTop: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
            {status}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface CategoryPickerProps {
  value: { id: string; name: string } | null;
  onChange: (cat: { id: string; name: string }) => void;
}

function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TwitchCategory[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      const token = getToken();
      if (!token) return;
      searchCategories(token, q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 380);
  };

  const handleSelect = (cat: TwitchCategory) => {
    onChange({ id: cat.id, name: cat.name });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={query || (open ? '' : (value?.name ?? ''))}
        onChange={e => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={value ? value.name : 'Search categories…'}
        style={{
          width: '100%',
          height: 40,
          padding: '0 14px',
          borderRadius: 10,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          color: 'var(--ink-0)',
          outline: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--bg-2)',
            border: '1px solid var(--border-2)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 16px 40px -8px rgba(0,0,0,.5)',
          }}
        >
          {results.map(cat => (
            <button
              key={cat.id}
              onMouseDown={() => handleSelect(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ink-1)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <img
                src={cat.box_art_url.replace('{width}', '24').replace('{height}', '32')}
                alt=""
                style={{ width: 18, height: 24, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
              />
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatEvent(event: { event_type: string; user_login: string | null; extra_data: Record<string, string> | null }) {
  switch (event.event_type) {
    case 'stream_online':  return 'Stream went live';
    case 'stream_offline': return 'Stream ended';
    case 'command':
      return event.user_login
        ? `@${event.user_login} used ${event.extra_data?.command ?? 'a command'}`
        : `Command used: ${event.extra_data?.command ?? '?'}`;
    default: return event.event_type;
  }
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatDuration(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface StreamManagerProps {
  live: boolean;
  liveStart: number | null;
  onRefresh: () => void;
  twitchUser: TwitchUser | null;
  stats: ChannelStats | null;
  statsLoading: boolean;
  streamInfo: StreamInfo | null;
  infoLoading: boolean;
  infoSaving: boolean;
  infoError: string | null;
  onSaveStreamInfo: (title: string, gameId: string) => Promise<void>;
  onTestAlert: () => void;
  onNav: (view: ViewId) => void;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function StreamManager({
  live,
  liveStart,
  onRefresh,
  twitchUser,
  stats,
  statsLoading,
  streamInfo,
  infoLoading,
  infoSaving,
  infoError,
  onSaveStreamInfo,
  onTestAlert,
  onNav,
}: StreamManagerProps) {
  const [duration, setDuration] = useState('0s');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<{ id: string; name: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activity, setActivity] = useState<Array<{
    event_type: string;
    user_login: string | null;
    extra_data: Record<string, string> | null;
    created_at: string;
  }>>([]);

  const apiUrl = import.meta.env.VITE_API_URL as string;

  useEffect(() => {
    if (!twitchUser) return;
    const token = getToken();
    if (!token) return;

    const fetchActivity = () => {
      fetch(`${apiUrl}/bot/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then((data: typeof activity) => setActivity(data))
        .catch(() => {});
    };

    fetchActivity();
    const id = setInterval(fetchActivity, 10_000);
    return () => clearInterval(id);
  }, [twitchUser]);

  useEffect(() => {
    if (!live || !liveStart) { setDuration('0s'); return; }
    setDuration(formatDuration(liveStart));
    const id = setInterval(() => setDuration(formatDuration(liveStart)), 5000);
    return () => clearInterval(id);
  }, [live, liveStart]);

  // Seed editable form from Twitch once loaded
  useEffect(() => {
    if (!streamInfo) return;
    setEditTitle(streamInfo.title);
    setEditCategory({ id: streamInfo.game_id, name: streamInfo.game_name });
  }, [streamInfo]);

  const handleSave = async () => {
    if (!editCategory) return;
    await onSaveStreamInfo(editTitle, editCategory.id);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const isDirty = streamInfo
    ? editTitle !== streamInfo.title || editCategory?.id !== streamInfo.game_id
    : false;

  const displayName = twitchUser?.display_name ?? twitchUser?.login ?? 'streamer';
  const channelStatus = twitchUser
    ? `Twitch · twitch.tv/${twitchUser.login}`
    : 'Not connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <Eyebrow>Stream Manager</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: '-0.02em',
            margin: '8px 0 4px',
          }}
        >
          Welcome back, {displayName}.
        </h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
          {live ? (
            <>Live for <strong style={{ color: 'var(--ink-0)' }}>{duration}</strong> — {stats?.viewerCount != null ? <><strong style={{ color: 'var(--ink-0)' }}>{fmt(stats.viewerCount)}</strong> watching</> : 'fetching viewers…'}</>
          ) : (
            <>You're offline. Update your info below before going live in OBS.</>
          )}
        </div>
      </div>

      {/* Live status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LivePill live={live} viewers={stats?.viewerCount ?? null} />
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" icon="refresh-cw" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {/* Stream info */}
      <Card style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Eyebrow>Stream info</Eyebrow>
          <div style={{ flex: 1 }} />
          {infoError && (
            <span style={{ fontSize: 12, color: '#F4526A', fontFamily: 'var(--font-mono)' }}>
              {infoError}
            </span>
          )}
          <Button
            variant={savedFlash ? 'success' : isDirty ? 'primary' : 'secondary'}
            size="sm"
            disabled={infoSaving || infoLoading || !isDirty}
            onClick={() => void handleSave()}
          >
            {infoSaving ? 'Saving…' : savedFlash ? 'Saved!' : 'Save to Twitch'}
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>Stream title</span>
            <input
              value={infoLoading ? '' : editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder={infoLoading ? 'Loading…' : 'Enter a stream title…'}
              maxLength={140}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 10,
                background: 'var(--bg-1)',
                border: '1px solid var(--border-2)',
                color: 'var(--ink-0)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>Category</span>
            {infoLoading
              ? <div style={{ height: 40, borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border-2)' }} />
              : <CategoryPicker value={editCategory} onChange={setEditCategory} />
            }
          </label>
        </div>
      </Card>

      {/* Analytics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatBox
          icon="eye"
          label="Viewers"
          value={statsLoading ? '…' : fmt(stats?.viewerCount)}
          sub={live ? 'watching now' : 'offline'}
        />
        <StatBox
          icon="users"
          label="Followers"
          value={statsLoading ? '…' : fmt(stats?.followers)}
          sub="total followers"
        />
        <StatBox
          icon="star"
          label="Subs"
          value={statsLoading ? '…' : fmt(stats?.subscribers)}
          sub={stats?.subscribers == null && !statsLoading ? 'affiliate only' : 'active subs'}
          accent="var(--maple-200)"
        />
        <StatBox
          icon="bot"
          label="Chat today"
          value="—"
          sub="bot not yet tracking"
        />
      </div>

      {/* Recent activity */}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-1)',
          }}
        >
          <Eyebrow style={{ color: 'var(--ink-3)' }}>Recent activity</Eyebrow>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon="play" onClick={onTestAlert}>Test alert</Button>
        </div>
        <div style={{ padding: '0 18px 8px' }}>
          {activity.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--ink-3)' }}>
              <Icon name="activity" size={20} />
              <span style={{ fontSize: 13 }}>No activity yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.slice(0, 15).map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: i < Math.min(activity.length, 15) - 1 ? '1px solid var(--border-1)' : 'none',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--ink-1)' }}>{formatEvent(ev)}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 11, flexShrink: 0, marginLeft: 12 }}>{relativeTime(ev.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Hub cards */}
      <div>
        <Eyebrow style={{ marginBottom: 12 }}>Your tools</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <HubCard icon="image"    accent="#C12F5D" title="Overlays" desc="Browser sources for OBS — alerts and chat overlays." status="Configure overlays" onClick={() => onNav('overlays')} />
          <HubCard icon="bot"      accent="#4ED4B5" title="Bot"      desc="MapleBot in chat — commands & auto-mod."           status="Commands & filters" onClick={() => onNav('bot-commands')} />
          <HubCard icon="settings" accent="#5BA8FF" title="Settings" desc="Channel connection and bot identity."               status={channelStatus}      onClick={() => onNav('settings')} />
        </div>
      </div>
    </div>
  );
}
