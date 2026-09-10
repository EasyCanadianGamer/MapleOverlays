import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { CHAT_FONTS, loadGoogleFont, inputStyle, labelStyle, labelTextStyle } from './Overlays';
import type {
  CodeWidgetConfig, NowPlayingWidgetConfig, ShoutoutWidgetConfig, ChatWidgetConfig,
} from '../lib/customOverlayWidgets';

const swatchStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border-2)',
  padding: 4, background: 'var(--bg-1)', cursor: 'pointer',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 12,
    border: `1px solid ${active ? 'var(--maple-500)' : 'var(--border-2)'}`,
    background: active ? 'rgba(193,47,93,.15)' : 'var(--bg-1)',
    color: active ? 'var(--maple-300)' : 'var(--ink-2)',
  };
}

function FontPicker({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  return (
    <div style={labelStyle}>
      <span style={labelTextStyle}>Font</span>
      <select
        value={value}
        onChange={e => {
          const f = CHAT_FONTS.find(x => x.value === e.target.value);
          if (f?.google) loadGoogleFont(f.value);
          onChange(e.target.value);
        }}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {CHAT_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
    </div>
  );
}

// ── Code widget ──────────────────────────────────────────────────────────────

const CODE_TABS = ['html', 'css', 'js'] as const;
type CodeTab = typeof CODE_TABS[number];

function extensionsFor(tab: CodeTab) {
  if (tab === 'html') return [html()];
  if (tab === 'css') return [css()];
  return [javascript()];
}

export function CodeWidgetProperties({ config, onChange }: { config: CodeWidgetConfig; onChange: (c: CodeWidgetConfig) => void }) {
  const [tab, setTab] = useState<CodeTab>('html');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const commit = (field: CodeTab, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ ...configRef.current, [field]: value }), 300);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        {CODE_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...pillStyle(tab === t), textTransform: 'uppercase' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-2)' }}>
        <CodeMirror
          key={tab}
          value={config[tab]}
          height="220px"
          theme="dark"
          extensions={extensionsFor(tab)}
          onChange={value => commit(tab, value)}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        Runs sandboxed — no access to your dashboard, other widgets, or viewer data.
      </div>
    </>
  );
}

// ── Now Playing widget ───────────────────────────────────────────────────────

export function NowPlayingWidgetProperties({ config, onChange }: { config: NowPlayingWidgetConfig; onChange: (c: NowPlayingWidgetConfig) => void }) {
  return (
    <>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Last.fm username</span>
        <input value={config.user} onChange={e => onChange({ ...config, user: e.target.value })} style={inputStyle} placeholder="lastfm username" />
      </label>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Twitch channel</span>
        <input value={config.channel} onChange={e => onChange({ ...config, channel: e.target.value })} style={inputStyle} placeholder="twitch login" />
      </label>
      <FontPicker value={config.font} onChange={font => onChange({ ...config, font })} />
      <div style={labelStyle}>
        <span style={labelTextStyle}>Card style</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['glass', 'dark', 'stripe'] as const).map(s => (
            <button key={s} onClick={() => onChange({ ...config, style: s })} style={pillStyle(config.style === s)}>{s}</button>
          ))}
        </div>
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Corner (within widget box)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(c => (
            <button key={c} onClick={() => onChange({ ...config, corner: c })} style={{ ...pillStyle(config.corner === c), flex: '1 0 45%', fontSize: 11 }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Accent colour</span>
        <input type="color" value={config.color} onChange={e => onChange({ ...config, color: e.target.value })} style={swatchStyle} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Text colour</span>
        <input type="color" value={config.fontColor} onChange={e => onChange({ ...config, fontColor: e.target.value })} style={swatchStyle} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Card duration — {config.duration}s</span>
        <input type="range" min={4} max={30} step={1} value={config.duration} onChange={e => onChange({ ...config, duration: Number(e.target.value) })} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Poll interval — {config.poll}s</span>
        <input type="range" min={10} max={60} step={5} value={config.poll} onChange={e => onChange({ ...config, poll: Number(e.target.value) })} />
      </div>
    </>
  );
}

// ── Shoutout widget ──────────────────────────────────────────────────────────

export function ShoutoutWidgetProperties({ config, onChange }: { config: ShoutoutWidgetConfig; onChange: (c: ShoutoutWidgetConfig) => void }) {
  return (
    <>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Twitch channel</span>
        <input value={config.channel} onChange={e => onChange({ ...config, channel: e.target.value })} style={inputStyle} placeholder="twitch login" />
      </label>
      <FontPicker value={config.font} onChange={font => onChange({ ...config, font })} />
      <div style={labelStyle}>
        <span style={labelTextStyle}>Text colour</span>
        <input type="color" value={config.color} onChange={e => onChange({ ...config, color: e.target.value })} style={swatchStyle} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Name size — {config.size}px</span>
        <input type="range" min={16} max={72} step={1} value={config.size} onChange={e => onChange({ ...config, size: Number(e.target.value) })} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Card duration — {config.duration}s</span>
        <input type="range" min={5} max={30} step={1} value={config.duration} onChange={e => onChange({ ...config, duration: Number(e.target.value) })} />
      </div>
    </>
  );
}

// ── Live chat widget ─────────────────────────────────────────────────────────

export function ChatWidgetProperties({ config, onChange }: { config: ChatWidgetConfig; onChange: (c: ChatWidgetConfig) => void }) {
  return (
    <>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Twitch channel</span>
        <input value={config.channel} onChange={e => onChange({ ...config, channel: e.target.value })} style={inputStyle} placeholder="twitch login" />
      </label>
      <FontPicker value={config.font} onChange={font => onChange({ ...config, font })} />
      <div style={labelStyle}>
        <span style={labelTextStyle}>Font size — {config.fontSize}px</span>
        <input type="range" min={10} max={28} step={1} value={config.fontSize} onChange={e => onChange({ ...config, fontSize: Number(e.target.value) })} />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Text colour</span>
        <input type="color" value={config.textColor} onChange={e => onChange({ ...config, textColor: e.target.value })} style={swatchStyle} />
      </div>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Username colour override (blank = each viewer's own colour)</span>
        <input type="color" value={config.usernameColor || '#ffffff'} onChange={e => onChange({ ...config, usernameColor: e.target.value })} style={swatchStyle} />
        <button
          onClick={() => onChange({ ...config, usernameColor: '' })}
          style={{ fontSize: 11, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', padding: 0 }}
        >
          Clear override
        </button>
      </label>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Background opacity — {config.bgOpacity}%</span>
        <input type="range" min={0} max={100} step={5} value={config.bgOpacity} onChange={e => onChange({ ...config, bgOpacity: Number(e.target.value) })} />
      </div>
    </>
  );
}
