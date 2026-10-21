import LivePill from '../ui/LivePill';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

interface TopBarProps {
  live: boolean;
  onToggleLive: () => void;
  viewers: number | null;
  title: string;
  onTitleChange: (value: string) => void;
  category?: string;
}

export default function TopBar({ live, onToggleLive, viewers, title, onTitleChange, category }: TopBarProps) {
  return (
    <header
      style={{
        height: 64,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'rgba(33,24,18,.80)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-1)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <LivePill live={live} viewers={viewers} />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          height: 38,
          background: 'var(--bg-2)',
          border: '1px solid var(--border-1)',
          borderRadius: 10,
        }}
      >
        <Icon name="play" size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Stream title…"
          maxLength={140}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'var(--ink-0)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {category || 'No category'}
        </span>
      </div>

      <Button
        variant={live ? 'danger' : 'primary'}
        icon={live ? 'stop' : 'play'}
        onClick={onToggleLive}
      >
        {live ? 'End stream' : 'Plug in. Go live.'}
      </Button>
    </header>
  );
}
