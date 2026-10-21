import { useState, useEffect, Component, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  renderTextWidget, renderImageWidget, renderCodeWidget, renderNowPlayingWidget, renderShoutoutWidget,
  type Widget, type TextWidgetConfig, type ImageWidgetConfig, type CodeWidgetConfig,
  type NowPlayingWidgetConfig, type ShoutoutWidgetConfig, type ChatWidgetConfig,
} from '../lib/customOverlayWidgets';
import { renderChatWidget } from '../lib/ChatWidgetView';

interface CustomOverlayData {
  id: number;
  name: string;
  widgets: Widget[];
}

export default function CustomOverlayRenderer() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CustomOverlayData | null>(null);

  // Transparent background for OBS browser source — same pattern as OverlaySource.tsx
  useEffect(() => {
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    const prevOverflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const prevRootBg = root?.style.background ?? '';
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    if (root) root.style.background = 'transparent';
    return () => {
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.overflow = prevOverflow;
      if (root) root.style.background = prevRootBg;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const apiUrl = import.meta.env.VITE_API_URL as string;
    fetch(`${apiUrl ?? ''}/custom-overlays/${id}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((body: CustomOverlayData) => setData(body))
      .catch(() => setData(null));
  }, [id]);

  if (!data) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {data.widgets.slice().sort((a, b) => a.z - b.z).map(widget => (
        <div
          key={widget.id}
          style={{
            position: 'absolute',
            left: `${widget.x}%`, top: `${widget.y}%`,
            width: `${widget.w}%`, height: `${widget.h}%`,
          }}
        >
          <WidgetErrorBoundary>{renderWidgetSafely(widget)}</WidgetErrorBoundary>
        </div>
      ))}
    </div>
  );
}

// A malformed widget (bad shape, unknown type) must not take down the whole
// overlay on this unauthenticated, always-on OBS browser source — skip it instead.
// The try/catch below covers errors thrown while building the element tree (e.g. reading
// a property off a missing config); WidgetErrorBoundary below covers errors React throws
// later, during reconciliation of an already-built tree (e.g. a non-string child) — a
// plain try/catch around the render call can't catch those since they happen outside its
// call stack, so both layers are needed to keep the widget-server's promise: one bad
// widget never takes down the rest of the overlay.
function renderWidgetSafely(widget: Widget) {
  try {
    if (widget.type === 'text') return renderTextWidget(widget.config as TextWidgetConfig);
    if (widget.type === 'image') return renderImageWidget(widget.config as ImageWidgetConfig);
    if (widget.type === 'code') return renderCodeWidget(widget.config as CodeWidgetConfig);
    if (widget.type === 'nowplaying') return renderNowPlayingWidget(widget.config as NowPlayingWidgetConfig);
    if (widget.type === 'shoutout') return renderShoutoutWidget(widget.config as ShoutoutWidgetConfig);
    if (widget.type === 'chat') return renderChatWidget(widget.config as ChatWidgetConfig);
    return null;
  } catch {
    return null;
  }
}

class WidgetErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
