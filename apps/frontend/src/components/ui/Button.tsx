import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';
import Icon from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface SizeConfig {
  height: number;
  padding: string;
  fontSize: number;
  borderRadius: number;
  gap: number;
}

const sizes: Record<ButtonSize, SizeConfig> = {
  sm: { height: 32, padding: '0 12px', fontSize: 13, borderRadius: 10, gap: 6 },
  md: { height: 40, padding: '0 18px', fontSize: 14, borderRadius: 12, gap: 8 },
  lg: { height: 52, padding: '0 24px', fontSize: 16, borderRadius: 14, gap: 10 },
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--maple-500)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: '0 1px 0 rgba(255,255,255,.18) inset, 0 6px 18px -6px rgba(172,7,71,.55)',
  },
  secondary: {
    background: 'var(--bg-3)',
    color: 'var(--ink-0)',
    border: '1px solid var(--border-2)',
    boxShadow: '0 1px 0 rgba(255,255,255,.05) inset',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--ink-1)',
    border: '1px solid transparent',
  },
  danger: {
    background: '#FF5470',
    color: '#2a0008',
    border: '1px solid transparent',
  },
  success: {
    background: '#22C58B',
    color: '#053D31',
    border: '1px solid transparent',
  },
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  style?: CSSProperties;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  onClick,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const s = sizes[size];
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        letterSpacing: '-0.005em',
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        borderRadius: s.borderRadius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'all .12s var(--ease-out)',
        ...v,
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={s.fontSize + 2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.fontSize + 2} />}
    </button>
  );
}
