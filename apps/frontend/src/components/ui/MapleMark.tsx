import type { CSSProperties } from 'react';
import logoColor from '../../assets/logo.png';
import logoWhite from '../../assets/logo-mark-white.png';
import logoBlack from '../../assets/logo-mark-black.png';

type MarkVariant = 'color' | 'white' | 'black';

const srcs: Record<MarkVariant, string> = {
  color: logoColor,
  white: logoWhite,
  black: logoBlack,
};

interface MapleMarkProps {
  size?: number;
  variant?: MarkVariant;
  style?: CSSProperties;
}

export default function MapleMark({ size = 24, variant = 'color', style }: MapleMarkProps) {
  return (
    <img
      src={srcs[variant]}
      width={size}
      height={size}
      alt="MapleOverlays"
      style={{ display: 'inline-block', objectFit: 'contain', ...style }}
    />
  );
}
