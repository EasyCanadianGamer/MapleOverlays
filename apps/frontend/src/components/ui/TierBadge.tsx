import type { CSSProperties } from 'react';

type Tier = 'free' | 'premium' | 'self';

interface TierConfig {
  c: string;
  bg: string;
  bd: string;
  label: string;
}

const tiers: Record<Tier, TierConfig> = {
  free:    { c: '#B7AAAE', bg: 'rgba(138,134,148,.14)', bd: 'rgba(138,134,148,.3)',  label: 'Free' },
  premium: { c: '#FFB627', bg: 'rgba(255,182,39,.12)',  bd: 'rgba(255,182,39,.3)',   label: 'Premium' },
  self:    { c: '#4ED4B5', bg: 'rgba(78,212,181,.12)',  bd: 'rgba(78,212,181,.3)',   label: 'Self-Hosted' },
};

interface TierBadgeProps {
  tier?: Tier;
  style?: CSSProperties;
}

export default function TierBadge({ tier = 'free', style }: TierBadgeProps) {
  const t = tiers[tier];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        background: t.bg,
        color: t.c,
        border: `1px solid ${t.bd}`,
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.c }} />
      {t.label}
    </span>
  );
}
