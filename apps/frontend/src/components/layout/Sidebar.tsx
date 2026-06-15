import { useState, useEffect, useRef } from 'react';
import MapleMark from '../ui/MapleMark';
import Icon from '../ui/Icon';
import type { TwitchUser } from '../../lib/twitchAuth';

export type ViewId = 'manager' | 'overlays' | 'bot-commands' | 'bot-settings' | 'bot-moderator' | 'settings';

export function isBotView(v: ViewId): boolean {
  return v === 'bot-commands' || v === 'bot-settings' || v === 'bot-moderator';
}

const BOT_SUB_ITEMS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'bot-commands',  icon: 'terminal', label: 'Commands'  },
  { id: 'bot-settings',  icon: 'settings', label: 'Settings'  },
  { id: 'bot-moderator', icon: 'shield',   label: 'Moderator' },
];

interface SidebarProps {
  view: ViewId;
  onNav: (view: ViewId) => void;
  twitchUser: TwitchUser | null;
  onLogout: () => void;
}

export default function Sidebar({ view, onNav, twitchUser, onLogout }: SidebarProps) {
  const displayName = twitchUser?.display_name ?? twitchUser?.login ?? null;
  const initial = displayName?.[0]?.toUpperCase() ?? '?';
  const [menuOpen, setMenuOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const menuItemBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 14px', border: 0, background: 'transparent',
    color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: 13,
    fontWeight: 500, cursor: 'pointer', textAlign: 'left',
    borderRadius: 8, transition: 'background .1s, color .1s',
  };

  function NavBtn({ id, icon, label }: { id: ViewId; icon: string; label: string }) {
    const active = view === id;
    return (
      <button
        onClick={() => onNav(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 10, border: 0,
          background: active ? 'rgba(193,47,93,.14)' : 'transparent',
          color: active ? 'var(--maple-100)' : 'var(--ink-2)',
          fontFamily: 'var(--font-body)', fontSize: 14,
          fontWeight: active ? 600 : 500, cursor: 'pointer',
          textAlign: 'left', transition: 'all .12s var(--ease-out)',
          position: 'relative', width: '100%',
        }}
      >
        {active && (
          <span style={{
            position: 'absolute', left: -14, top: 8, bottom: 8, width: 3,
            background: 'var(--maple-400)', borderRadius: '0 2px 2px 0',
          }} />
        )}
        <Icon name={icon} size={18} />
        {label}
      </button>
    );
  }

  function SubNavBtn({ id, icon, label }: { id: ViewId; icon: string; label: string }) {
    const active = view === id;
    return (
      <button
        onClick={() => onNav(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8, border: 0,
          background: active ? 'rgba(193,47,93,.10)' : 'transparent',
          color: active ? 'var(--maple-200)' : 'var(--ink-3)',
          fontFamily: 'var(--font-body)', fontSize: 13,
          fontWeight: active ? 600 : 400, cursor: 'pointer',
          textAlign: 'left', transition: 'all .12s var(--ease-out)',
          width: '100%',
        }}
      >
        <Icon name={icon} size={15} />
        {label}
      </button>
    );
  }

  const botActive = isBotView(view);

  return (
    <aside style={{
      width: 240, flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--border-1)', padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
      height: '100vh', position: 'sticky', top: 0, zIndex: 20,
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px' }}>
        <MapleMark size={28} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink-0)' }}>
          MapleOverlays
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavBtn id="manager"  icon="play"     label="Stream Manager" />
        <NavBtn id="overlays" icon="image"    label="Overlays" />

        {/* Bot group */}
        <button
          onClick={() => onNav('bot-commands')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 10, border: 0,
            background: botActive ? 'rgba(193,47,93,.14)' : 'transparent',
            color: botActive ? 'var(--maple-100)' : 'var(--ink-2)',
            fontFamily: 'var(--font-body)', fontSize: 14,
            fontWeight: botActive ? 600 : 500, cursor: 'pointer',
            textAlign: 'left', transition: 'all .12s var(--ease-out)',
            position: 'relative', width: '100%',
          }}
        >
          {botActive && (
            <span style={{
              position: 'absolute', left: -14, top: 8, bottom: 8, width: 3,
              background: 'var(--maple-400)', borderRadius: '0 2px 2px 0',
            }} />
          )}
          <Icon name="bot" size={18} />
          Bot
        </button>

        {botActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 14, marginBottom: 2 }}>
            {BOT_SUB_ITEMS.map(item => (
              <SubNavBtn key={item.id} id={item.id} icon={item.icon} label={item.label} />
            ))}
          </div>
        )}

        <NavBtn id="settings" icon="settings" label="Settings" />
      </nav>

      <div style={{ flex: 1 }} />

      {/* Account chip + drop-up */}
      <div ref={chipRef} style={{ position: 'relative' }}>
        {menuOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
            background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 14,
            boxShadow: '0 -8px 32px -8px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset',
            padding: 6, display: 'flex', flexDirection: 'column', gap: 1,
            animation: 'overlay-slide-up .18s var(--ease-out)',
          }}>
            {twitchUser && (
              <button
                style={menuItemBase}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                onClick={() => { window.open(`https://twitch.tv/${twitchUser.login}`, '_blank'); setMenuOpen(false); }}
              >
                <Icon name="twitch" size={15} />
                View Twitch profile
              </button>
            )}
            <button
              style={menuItemBase}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => { onNav('settings'); setMenuOpen(false); }}
            >
              <Icon name="settings" size={15} />
              Settings
            </button>
            <div style={{ height: 1, background: 'var(--border-1)', margin: '4px 6px' }} />
            <button
              style={{ ...menuItemBase, color: 'var(--danger)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,84,112,.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => { onLogout(); setMenuOpen(false); }}
            >
              <Icon name="log-out" size={15} />
              Log out
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 12,
            background: menuOpen ? 'var(--bg-3)' : 'var(--bg-2)',
            border: `1px solid ${menuOpen ? 'var(--border-2)' : 'var(--border-1)'}`,
            cursor: 'pointer', transition: 'background .12s, border-color .12s',
          }}
        >
          {twitchUser?.profile_image_url ? (
            <img src={twitchUser.profile_image_url} alt={displayName ?? ''}
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-4)',
              display: 'grid', placeItems: 'center', fontFamily: 'var(--font-body)',
              fontWeight: 700, fontSize: 12, color: 'var(--ink-0)', flexShrink: 0,
            }}>{initial}</div>
          )}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName ?? 'Not connected'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: twitchUser ? '#A970FF' : 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              <Icon name="twitch" size={11} style={{ color: twitchUser ? '#A970FF' : 'var(--ink-4)' }} />
              {twitchUser ? 'twitch' : 'disconnected'}
            </div>
          </div>
          <Icon name="chevrons-up-down" size={14}
            style={{ color: 'var(--ink-4)', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>
    </aside>
  );
}
