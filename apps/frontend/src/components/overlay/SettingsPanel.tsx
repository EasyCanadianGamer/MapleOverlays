import type { CSSProperties, ReactNode } from 'react';
import Card from '../ui/Card';
import Eyebrow from '../ui/Eyebrow';
import Toggle from '../ui/Toggle';
import FontField from './FontField';
import type { FieldDef, OverlayConfig, SectionDef } from '../../lib/overlayApi';

const inputStyle: CSSProperties = {
  height: 36, padding: '0 12px', borderRadius: 10, background: 'var(--bg-1)',
  border: '1px solid var(--border-2)', color: 'var(--ink-0)', outline: 'none',
  fontFamily: 'var(--font-body)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      {children}
      {help && <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.45 }}>{help}</span>}
    </div>
  );
}

function FieldControl({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (value: unknown) => void }) {
  switch (field.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : field.default;
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="range" min={field.min} max={field.max} value={n} style={{ flex: 1 }}
            onChange={e => onChange(Number(e.target.value))}
          />
          <input
            type="number" min={field.min} max={field.max} value={n} style={{ ...inputStyle, width: 84 }}
            onChange={e => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.min(field.max, v));
            }}
            onBlur={e => {
              const v = Number(e.target.value);
              onChange(Number.isFinite(v) ? Math.min(field.max, Math.max(field.min, Math.round(v))) : field.default);
            }}
          />
        </div>
      );
    }
    case 'boolean':
      return <div><Toggle on={value === true} onChange={onChange} /></div>;
    case 'color': {
      const v = typeof value === 'string' ? value : field.default;
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="color" value={v} onChange={e => onChange(e.target.value)} style={{ width: 44, height: 34, padding: 0, border: 0, background: 'none', cursor: 'pointer' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{v}</span>
        </div>
      );
    }
    case 'select':
      return (
        <select style={inputStyle} value={typeof value === 'string' ? value : field.default} onChange={e => onChange(e.target.value)}>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'list':
      return (
        <input
          style={inputStyle} maxLength={field.maxLength}
          placeholder="comma, separated, values"
          value={typeof value === 'string' ? value : field.default}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'text':
      return (
        <textarea
          rows={7} maxLength={field.maxLength} spellCheck={false}
          style={{ ...inputStyle, height: 'auto', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
          value={typeof value === 'string' ? value : field.default}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'font':
      return <FontField value={typeof value === 'string' ? value : field.default} onChange={onChange} />;
  }
}

export interface SettingsPanelProps {
  sections: SectionDef[];
  value: OverlayConfig;
  onChange: (key: string, value: unknown) => void;
}

export default function SettingsPanel({ sections, value, onChange }: SettingsPanelProps) {
  return (
    <>
      {sections.map(section => (
        <Card key={section.id} style={{ padding: 22 }}>
          <Eyebrow>{section.label}</Eyebrow>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {section.fields.map(field => (
              <Row key={field.key} label={field.label} help={field.help}>
                <FieldControl field={field} value={value[field.key]} onChange={v => onChange(field.key, v)} />
              </Row>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}
