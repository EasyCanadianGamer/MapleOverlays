import type { CSSProperties, ReactNode, HTMLAttributes } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  children?: ReactNode;
  padded?: boolean;
  style?: CSSProperties;
  className?: string;
}

export default function Card({ children, padded = true, style, className, ...rest }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-2)',
        padding: padded ? 20 : 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
