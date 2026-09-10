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

export type WidgetType = 'text' | 'image';

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

export type Widget = TextWidget | ImageWidget;

export function defaultConfigFor(type: WidgetType): TextWidgetConfig | ImageWidgetConfig {
  if (type === 'text') {
    return { content: 'New text', fontFamily: 'Geist', fontSize: 32, color: '#ffffff', align: 'left' };
  }
  return { url: '', fit: 'contain' };
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
