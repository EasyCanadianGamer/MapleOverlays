import type { CSSProperties, FC } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Layout, Image, Terminal, Bot, Bell, Settings, Play, Square, Eye,
  Star, Plus, Copy, Tv, PlayCircle, Users, Zap, ChevronRight,
  Search, Gift, Heart, Upload, RefreshCw, Code, GitBranch, Check,
  MessageSquare, Music, ShieldCheck, Trash2, Activity,
} from 'lucide-react';

const icons: Record<string, FC<LucideProps>> = {
  layout:   Layout,
  image:    Image,
  terminal: Terminal,
  bot:      Bot,
  bell:     Bell,
  settings: Settings,
  play:     Play,
  stop:     Square,
  eye:      Eye,
  star:     Star,
  check:    Check,
  plus:     Plus,
  copy:     Copy,
  twitch:   Tv,
  youtube:  PlayCircle,
  discord:  MessageSquare,
  users:    Users,
  zap:      Zap,
  chevron:  ChevronRight,
  search:   Search,
  gift:     Gift,
  heart:    Heart,
  upload:   Upload,
  refresh:  RefreshCw,
  code:     Code,
  git:      GitBranch,
  music:    Music,
  shield:   ShieldCheck,
  trash:    Trash2,
  activity: Activity,
};

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}

export default function Icon({ name, size = 16, stroke = 1.5, style, className }: IconProps) {
  const Component = icons[name];
  if (!Component) return null;
  return <Component size={size} strokeWidth={stroke} style={style} className={className} />;
}
