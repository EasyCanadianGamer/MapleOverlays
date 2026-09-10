import { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { getToken } from '../lib/twitchAuth';
// Circular import: Overlays.tsx also imports CustomOverlayEditor. Safe only because these
// bindings are read inside render functions, never at module scope — a top-level read here
// would throw a TDZ ReferenceError depending on import order.
import { CHAT_FONTS, loadGoogleFont, CopyUrlChip, inputStyle, labelStyle, labelTextStyle } from './Overlays';
import {
  renderTextWidget, renderImageWidget, defaultConfigFor,
  type Widget, type TextWidgetConfig, type ImageWidgetConfig,
} from '../lib/customOverlayWidgets';

interface CustomOverlay {
  id: number;
  name: string;
  widgets: Widget[];
}

const MIN_WIDGET_SIZE = 5; // percent

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export default function CustomOverlayEditor({ overlayId, onBack }: { overlayId: number; onBack: () => void }) {
  const apiUrl = (import.meta.env.VITE_API_URL as string) ?? '';
  const [overlay, setOverlay] = useState<CustomOverlay | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string; mode: 'move' | 'resize';
    startClientX: number; startClientY: number;
    startX: number; startY: number; startW: number; startH: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/custom-overlays/${overlayId}`)
      .then(r => { if (!r.ok) throw new Error('load failed'); return r.json(); })
      .then((data: CustomOverlay) => setOverlay(data))
      .catch(() => setLoadError(true));
  }, [apiUrl, overlayId]);

  const updateWidget = useCallback((id: string, patch: Partial<Widget>) => {
    setOverlay(prev => prev
      ? { ...prev, widgets: prev.widgets.map(w => (w.id === id ? ({ ...w, ...patch } as Widget) : w)) }
      : prev);
  }, []);

  const onPointerDownWidget = (e: React.PointerEvent, widget: Widget, mode: 'move' | 'resize') => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedId(widget.id);
    dragRef.current = {
      id: widget.id, mode,
      startClientX: e.clientX, startClientY: e.clientY,
      startX: widget.x, startY: widget.y, startW: widget.w, startH: widget.h,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || !overlay) return;
    const widget = overlay.widgets.find(w => w.id === drag.id);
    if (!widget) return;
    const rect = canvas.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;
    if (drag.mode === 'move') {
      const x = clamp(drag.startX + dxPct, 0, 100 - widget.w);
      const y = clamp(drag.startY + dyPct, 0, 100 - widget.h);
      updateWidget(drag.id, { x, y });
    } else {
      const w = clamp(drag.startW + dxPct, MIN_WIDGET_SIZE, 100 - widget.x);
      const h = clamp(drag.startH + dyPct, MIN_WIDGET_SIZE, 100 - widget.y);
      updateWidget(drag.id, { w, h });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  const addWidget = (type: 'text' | 'image') => {
    if (!overlay) return;
    const maxZ = overlay.widgets.reduce((m, w) => Math.max(m, w.z), 0);
    const widget = {
      id: crypto.randomUUID(),
      type,
      x: 35, y: 40,
      w: type === 'text' ? 30 : 20,
      h: type === 'text' ? 10 : 20,
      z: maxZ + 1,
      config: defaultConfigFor(type),
    } as Widget;
    setOverlay({ ...overlay, widgets: [...overlay.widgets, widget] });
    setSelectedId(widget.id);
  };

  const removeSelected = () => {
    if (!overlay || !selectedId) return;
    setOverlay({ ...overlay, widgets: overlay.widgets.filter(w => w.id !== selectedId) });
    setSelectedId(null);
  };

  const bringToFront = () => {
    if (!overlay || !selectedId) return;
    const maxZ = overlay.widgets.reduce((m, w) => Math.max(m, w.z), 0);
    updateWidget(selectedId, { z: maxZ + 1 });
  };

  const sendToBack = () => {
    if (!overlay || !selectedId) return;
    const minZ = overlay.widgets.reduce((m, w) => Math.min(m, w.z), 0);
    updateWidget(selectedId, { z: minZ - 1 });
  };

  const save = async () => {
    if (!overlay) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch(`${apiUrl}/custom-overlays/${overlay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: overlay.name, widgets: overlay.widgets }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: 40, color: 'var(--ink-2)' }}>
        Couldn't load this overlay. It may have been deleted.{' '}
        <button
          onClick={onBack}
          style={{ color: 'var(--maple-300)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
        >
          Go back
        </button>
      </div>
    );
  }

  if (!overlay) {
    return <div style={{ padding: 40, color: 'var(--ink-2)' }}>Loading…</div>;
  }

  const selectedWidget = overlay.widgets.find(w => w.id === selectedId) ?? null;
  const renderUrl = `${window.location.origin}/overlays/custom/${overlay.id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 10,
            border: '1px solid var(--border-2)', background: 'var(--bg-2)',
            color: 'var(--ink-1)', fontFamily: 'var(--font-body)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          Back
        </button>
        <input
          value={overlay.name}
          onChange={e => setOverlay({ ...overlay, name: e.target.value })}
          style={{ ...inputStyle, width: 220, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}
        />
        <div style={{ flex: 1 }} />
        <div style={{ maxWidth: 300 }}>
          <CopyUrlChip url={renderUrl} />
        </div>
        {saveError && (
          <div style={{ fontSize: 12, color: '#F4526A', fontFamily: 'var(--font-mono)' }}>Failed to save</div>
        )}
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 300px', gap: 20, alignItems: 'start' }}>
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>Widgets</Eyebrow>
          <Button variant="secondary" icon="plus" onClick={() => addWidget('text')}>Text</Button>
          <Button variant="secondary" icon="plus" onClick={() => addWidget('image')}>Image</Button>
        </Card>

        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => setSelectedId(null)}
          style={{
            position: 'relative', width: '100%', aspectRatio: '16/9',
            background: '#0a0604', borderRadius: 12, overflow: 'hidden',
            border: '1px solid var(--border-1)',
          }}
        >
          {overlay.widgets.slice().sort((a, b) => a.z - b.z).map(widget => (
            <div
              key={widget.id}
              onPointerDown={e => onPointerDownWidget(e, widget, 'move')}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${widget.x}%`, top: `${widget.y}%`,
                width: `${widget.w}%`, height: `${widget.h}%`,
                outline: selectedId === widget.id ? '2px solid var(--maple-400)' : 'none',
                cursor: 'move', boxSizing: 'border-box', userSelect: 'none',
              }}
            >
              {widget.type === 'text'
                ? renderTextWidget(widget.config as TextWidgetConfig)
                : renderImageWidget(widget.config as ImageWidgetConfig)}
              {selectedId === widget.id && (
                <div
                  onPointerDown={e => onPointerDownWidget(e, widget, 'resize')}
                  style={{
                    position: 'absolute', right: -6, bottom: -6,
                    width: 12, height: 12, borderRadius: 3,
                    background: 'var(--maple-400)', cursor: 'nwse-resize',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <Card style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 200 }}>
          <Eyebrow>Properties</Eyebrow>
          {!selectedWidget && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              Select a widget to edit it, or add one from the palette.
            </div>
          )}
          {selectedWidget && (
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={bringToFront}>Bring to front</Button>
                <Button size="sm" variant="ghost" onClick={sendToBack}>Send to back</Button>
              </div>
              {selectedWidget.type === 'text' && (
                <TextWidgetProperties
                  config={selectedWidget.config}
                  onChange={c => updateWidget(selectedWidget.id, { config: c })}
                />
              )}
              {selectedWidget.type === 'image' && (
                <ImageWidgetProperties
                  config={selectedWidget.config}
                  onChange={c => updateWidget(selectedWidget.id, { config: c })}
                />
              )}
              <Button
                size="sm" variant="ghost" icon="trash"
                onClick={removeSelected}
                style={{ color: '#F4526A', alignSelf: 'flex-start' }}
              >
                Delete widget
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function TextWidgetProperties({ config, onChange }: { config: TextWidgetConfig; onChange: (c: TextWidgetConfig) => void }) {
  return (
    <>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Text</span>
        <textarea
          value={config.content}
          onChange={e => onChange({ ...config, content: e.target.value })}
          style={{ ...inputStyle, height: 70, padding: 10, resize: 'vertical' }}
        />
      </label>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Font</span>
        <select
          value={config.fontFamily}
          onChange={e => {
            const f = CHAT_FONTS.find(x => x.value === e.target.value);
            if (f?.google) loadGoogleFont(f.value);
            onChange({ ...config, fontFamily: e.target.value });
          }}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {CHAT_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Font size — {config.fontSize}px</span>
        <input
          type="range" min={10} max={120} step={1}
          value={config.fontSize}
          onChange={e => onChange({ ...config, fontSize: Number(e.target.value) })}
        />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Colour</span>
        <input
          type="color"
          value={config.color}
          onChange={e => onChange({ ...config, color: e.target.value })}
          style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border-2)', padding: 4, background: 'var(--bg-1)', cursor: 'pointer' }}
        />
      </div>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Align</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              onClick={() => onChange({ ...config, align: a })}
              style={{
                flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${config.align === a ? 'var(--maple-500)' : 'var(--border-2)'}`,
                background: config.align === a ? 'rgba(193,47,93,.15)' : 'var(--bg-1)',
                color: config.align === a ? 'var(--maple-300)' : 'var(--ink-2)',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ImageWidgetProperties({ config, onChange }: { config: ImageWidgetConfig; onChange: (c: ImageWidgetConfig) => void }) {
  return (
    <>
      <label style={labelStyle}>
        <span style={labelTextStyle}>Image URL</span>
        <input
          value={config.url}
          onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://…"
          style={inputStyle}
        />
      </label>
      <div style={labelStyle}>
        <span style={labelTextStyle}>Fit</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['contain', 'cover'] as const).map(f => (
            <button
              key={f}
              onClick={() => onChange({ ...config, fit: f })}
              style={{
                flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${config.fit === f ? 'var(--maple-500)' : 'var(--border-2)'}`,
                background: config.fit === f ? 'rgba(193,47,93,.15)' : 'var(--bg-1)',
                color: config.fit === f ? 'var(--maple-300)' : 'var(--ink-2)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
