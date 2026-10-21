import type { CSSProperties, ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export default function Eyebrow({ children, color = 'var(--maple-300)', style }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
