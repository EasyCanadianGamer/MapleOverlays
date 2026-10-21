interface LivePillProps {
  live: boolean;
  viewers?: number | null;
}

export default function LivePill({ live, viewers }: LivePillProps) {
  if (!live) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'var(--bg-3)',
          color: 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '.14em',
          border: '1px solid var(--border-2)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--ink-3)' }} />
        OFFLINE
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: '#FF3B5C',
        color: '#fff',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.14em',
      }}
    >
      <span className="live-dot" />
      LIVE
      {viewers != null && (
        <span style={{ opacity: 0.85, fontWeight: 600 }}>· {viewers.toLocaleString()}</span>
      )}
    </span>
  );
}
