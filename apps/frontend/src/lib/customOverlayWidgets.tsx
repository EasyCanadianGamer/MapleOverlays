export interface TextWidgetConfig {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageWidgetConfig {
  url: string;
  fit: 'contain' | 'cover';
}

export interface CodeWidgetConfig {
  html: string;
  css: string;
  js: string;
}

export interface NowPlayingWidgetConfig {
  user: string;
  channel: string;
  duration: number;
  corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  color: string;
  font: string;
  fontColor: string;
  style: 'glass' | 'dark' | 'stripe';
  poll: number;
}

export interface ShoutoutWidgetConfig {
  channel: string;
  font: string;
  color: string;
  size: number;
  duration: number;
}

export interface ChatWidgetConfig {
  channel: string;
  font: string;
  fontSize: number;
  textColor: string;
  usernameColor: string;
  bgOpacity: number;
}

export type WidgetType = 'text' | 'image' | 'code' | 'nowplaying' | 'shoutout' | 'chat';

export interface BaseWidget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface TextWidget extends BaseWidget {
  type: 'text';
  config: TextWidgetConfig;
}

export interface ImageWidget extends BaseWidget {
  type: 'image';
  config: ImageWidgetConfig;
}

export interface CodeWidget extends BaseWidget {
  type: 'code';
  config: CodeWidgetConfig;
}

export interface NowPlayingWidget extends BaseWidget {
  type: 'nowplaying';
  config: NowPlayingWidgetConfig;
}

export interface ShoutoutWidget extends BaseWidget {
  type: 'shoutout';
  config: ShoutoutWidgetConfig;
}

export interface ChatWidget extends BaseWidget {
  type: 'chat';
  config: ChatWidgetConfig;
}

export type Widget = TextWidget | ImageWidget | CodeWidget | NowPlayingWidget | ShoutoutWidget | ChatWidget;

export function defaultConfigFor(
  type: WidgetType
): TextWidgetConfig | ImageWidgetConfig | CodeWidgetConfig | NowPlayingWidgetConfig | ShoutoutWidgetConfig | ChatWidgetConfig {
  if (type === 'text') {
    return { content: 'New text', fontFamily: 'Geist', fontSize: 32, color: '#ffffff', align: 'left' };
  }
  if (type === 'image') {
    return { url: '', fit: 'contain' };
  }
  if (type === 'code') {
    return {
      html: '<div class="hello">Hello, overlay!</div>',
      css: '.hello { font: 700 28px sans-serif; color: #fff; }',
      js: '',
    };
  }
  if (type === 'nowplaying') {
    return {
      user: '', channel: '', duration: 10, corner: 'bottom-left',
      color: '#AC0747', font: 'Geist', fontColor: '#ffffff', style: 'glass', poll: 15,
    };
  }
  if (type === 'shoutout') {
    return { channel: '', font: 'Geist', color: '#ffffff', size: 32, duration: 12 };
  }
  return { channel: '', font: 'Geist', fontSize: 15, textColor: '#ffffff', usernameColor: '', bgOpacity: 75 };
}

export function renderTextWidget(config: TextWidgetConfig) {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center',
        justifyContent: config.align === 'center' ? 'center' : config.align === 'right' ? 'flex-end' : 'flex-start',
        fontFamily: `${config.fontFamily}, sans-serif`,
        fontSize: config.fontSize,
        color: config.color,
        textAlign: config.align,
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {config.content}
    </div>
  );
}

export function renderImageWidget(config: ImageWidgetConfig) {
  if (!config.url) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'grid', placeItems: 'center',
        background: 'rgba(255,255,255,.05)', border: '1px dashed rgba(255,255,255,.2)',
        color: 'rgba(255,255,255,.3)', fontSize: 11, fontFamily: 'monospace',
      }}>
        no image url
      </div>
    );
  }
  return (
    <img
      src={config.url}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: config.fit, display: 'block' }}
    />
  );
}

export function renderCodeWidget(config: CodeWidgetConfig) {
  const doc = `<!doctype html><html><head><style>${config.css}</style></head>` +
    `<body>${config.html}<script>${config.js}</script></body></html>`;
  return (
    <iframe
      srcDoc={doc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
    />
  );
}

// Unlike the code widget, this iframe loads our own trusted app route (not
// user content), so it also gets `allow-same-origin`. Without it the frame
// would have an opaque origin and its fetch() calls to the API would send
// `Origin: null` — the API's CORS middleware (`cors({ origin: process.env.FRONTEND_URL })`)
// does a strict string match against that header and would reject them,
// silently breaking the widget's polling.
export function renderNowPlayingWidget(config: NowPlayingWidgetConfig) {
  const params = new URLSearchParams({
    user: config.user,
    channel: config.channel,
    duration: String(config.duration),
    corner: config.corner,
    color: config.color,
    font: config.font,
    fcolor: config.fontColor,
    style: config.style,
    poll: String(config.poll),
  });
  return (
    <iframe
      src={`${window.location.origin}/overlays/nowplaying?${params.toString()}`}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
    />
  );
}

export function renderShoutoutWidget(config: ShoutoutWidgetConfig) {
  const params = new URLSearchParams({
    channel: config.channel,
    font: config.font,
    color: config.color,
    size: String(config.size),
    duration: String(config.duration),
  });
  return (
    <iframe
      src={`${window.location.origin}/overlays/shoutout?${params.toString()}`}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
    />
  );
}
