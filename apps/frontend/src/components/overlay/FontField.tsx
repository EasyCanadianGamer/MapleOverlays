import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { listFonts, uploadFont, type UploadedFont } from '../../lib/overlayApi';
import { BUILT_IN_FONTS, FAMILY_RE, parseFontRef, type FontSource } from '../../lib/fontRef';

const POPULAR_GOOGLE = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Oswald', 'Press Start 2P', 'Permanent Marker', 'Pacifico'];

const inputStyle: React.CSSProperties = {
  height: 36, padding: '0 12px', borderRadius: 10, background: 'var(--bg-1)',
  border: '1px solid var(--border-2)', color: 'var(--ink-0)', outline: 'none',
  fontFamily: 'var(--font-body)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};

const TABS: { id: FontSource; label: string }[] = [
  { id: 'builtin', label: 'Built-in' },
  { id: 'google', label: 'Google Fonts' },
  { id: 'upload', label: 'Upload' },
];

export default function FontField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const current = parseFontRef(value);
  const [tab, setTab] = useState<FontSource>(current.source);
  const [googleText, setGoogleText] = useState(current.source === 'google' ? current.value : '');
  const [fonts, setFonts] = useState<UploadedFont[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listFonts().then(setFonts).catch(() => setError('Could not load your uploaded fonts.'));
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const font = await uploadFont(file, file.name.replace(/\.[^.]+$/, ''));
      setFonts(prev => [...prev, font]);
      onChange(`upload:${font.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const googleInvalid = googleText.trim() !== '' && !FAMILY_RE.test(googleText.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-body)',
              background: tab === t.id ? 'rgba(193,47,93,.18)' : 'var(--bg-1)',
              color: tab === t.id ? 'var(--maple-100)' : 'var(--ink-2)',
              border: `1px solid ${tab === t.id ? 'var(--maple-400)' : 'var(--border-2)'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builtin' && (
        <select
          style={inputStyle}
          value={current.source === 'builtin' ? current.value : ''}
          onChange={e => onChange(`builtin:${e.target.value}`)}
        >
          {current.source !== 'builtin' && <option value="">Choose a font…</option>}
          {BUILT_IN_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      )}

      {tab === 'google' && (
        <>
          <input
            style={inputStyle}
            value={googleText}
            list="mw-google-fonts"
            placeholder="Type a Google Fonts family, e.g. Poppins"
            onChange={e => {
              setGoogleText(e.target.value);
              const v = e.target.value.trim();
              if (FAMILY_RE.test(v)) onChange(`google:${v}`);
            }}
          />
          <datalist id="mw-google-fonts">
            {POPULAR_GOOGLE.map(f => <option key={f} value={f} />)}
          </datalist>
          {googleInvalid && <div style={{ fontSize: 12, color: '#e05252' }}>Use letters, numbers, spaces, dots, dashes or underscores only.</div>}
        </>
      )}

      {tab === 'upload' && (
        <>
          {fonts.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No uploaded fonts yet.</div>}
          {fonts.map(f => {
            const selected = current.source === 'upload' && current.value === f.id;
            return (
              <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onChange(`upload:${f.id}`)}
                  style={{
                    flex: 1, textAlign: 'left', height: 34, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: 13,
                    background: selected ? 'rgba(193,47,93,.18)' : 'var(--bg-1)',
                    color: selected ? 'var(--maple-100)' : 'var(--ink-1)',
                    border: `1px solid ${selected ? 'var(--maple-400)' : 'var(--border-2)'}`,
                  }}
                >
                  {f.family} <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>· {f.format} · {Math.ceil(f.size_bytes / 1024)} KB</span>
                </button>
              </div>
            );
          })}
          <input ref={fileRef} type="file" accept=".woff2,.woff,.ttf,.otf" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={14} /> {busy ? 'Uploading…' : 'Upload a font file'}
          </Button>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            woff2, woff, ttf or otf, up to 2 MB, 10 fonts. Only upload fonts you have the right to use.{' '}
            <Link to="/dashboard/overlays/files" style={{ color: 'var(--maple-300)' }}>Manage your files</Link> to delete one.
          </div>
        </>
      )}

      {error && <div style={{ fontSize: 12, color: '#e05252' }}>{error}</div>}
    </div>
  );
}
