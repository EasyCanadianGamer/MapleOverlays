import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Icon from '../components/ui/Icon';
import { deleteFont, listFonts, uploadFont, type UploadedFont } from '../lib/overlayApi';
import { useOverlayFont } from '../lib/useOverlayFont';

const MAX_FONTS = 10;
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`);

function FontRow({ font, onDelete }: { font: UploadedFont; onDelete: (font: UploadedFont) => void }) {
  useOverlayFont(`upload:${font.id}`);
  const usedBy = font.used_by ?? [];
  const inUse = usedBy.length > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid var(--border-1)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, wordBreak: 'break-word' }}>{font.family}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {font.format} · {formatSize(font.size_bytes)}
        </div>
        <div style={{ marginTop: 8, fontSize: 22, color: 'var(--ink-1)', fontFamily: `"mw-upload-${font.id}", var(--font-body)`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          The quick brown fox 123
        </div>
      </div>
      <div style={{ flex: '1 1 180px', fontSize: 13, color: 'var(--ink-2)' }}>
        {inUse ? (
          <>
            Used by{' '}
            {usedBy.map((o, i) => (
              <span key={o.id}>
                {i > 0 && ', '}
                <Link to={`/dashboard/overlays/${o.id}`} style={{ color: 'var(--maple-300)' }}>{o.name}</Link>
              </span>
            ))}
          </>
        ) : 'Not used by any overlay'}
      </div>
      <Button
        variant="ghost" size="sm" icon="trash" onClick={() => onDelete(font)} disabled={inUse}
        title={inUse ? 'Pick another font in those overlays first' : undefined}
        aria-label={`Delete ${font.family}`}
      >
        Delete
      </Button>
    </div>
  );
}

// A file section of the Files page. Fonts are the only kind today; images, GIFs and videos
// can be added later as more sections with the same shape: a title, a count, rows, an upload button.
function FileSection({ title, count, max, action, children }: {
  title: string; count: number; max: number; action: ReactNode; children: ReactNode;
}) {
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Eyebrow>{title}</Eyebrow>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-3)' }}>{count} of {max} used</div>
        </div>
        {action}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </Card>
  );
}

export default function OverlayFiles() {
  const [fonts, setFonts] = useState<UploadedFont[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listFonts()
      .then(list => { if (!cancelled) setFonts(list); })
      .catch(err => { if (!cancelled) setError(message(err, 'Could not load your files.')); });
    return () => { cancelled = true; };
  }, []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const font = await uploadFont(file, file.name.replace(/\.[^.]+$/, ''));
      setFonts(prev => [...(prev ?? []), { ...font, used_by: font.used_by ?? [] }]);
    } catch (err) {
      setError(message(err, 'Upload failed.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (font: UploadedFont) => {
    if (!window.confirm(`Delete the font "${font.family}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteFont(font.id);
      setFonts(prev => (prev ?? []).filter(f => f.id !== font.id));
    } catch (err) {
      setError(message(err, 'Could not delete the font.'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link to="/dashboard/overlays" style={{ color: 'var(--maple-300)', fontSize: 13, textDecoration: 'none' }}>← Back to overlays</Link>
        <div style={{ marginTop: 12 }}><Eyebrow>Files</Eyebrow></div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>Your files.</h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>Everything you have uploaded for your overlays, and which overlays use it.</div>
      </div>

      {error && <Card style={{ padding: 16, borderColor: 'rgba(224,82,82,.4)' }}><div style={{ fontSize: 14, color: '#e05252' }}>{error}</div></Card>}

      <FileSection
        title="Fonts" count={fonts?.length ?? 0} max={MAX_FONTS}
        action={(
          <>
            <input ref={fileRef} type="file" accept=".woff2,.woff,.ttf,.otf" style={{ display: 'none' }} onChange={e => void upload(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={14} /> {busy ? 'Uploading…' : 'Upload a font'}
            </Button>
          </>
        )}
      >
        {fonts === null && !error && <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Loading…</div>}
        {fonts !== null && fonts.length === 0 && (
          <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>No fonts yet. Upload a woff2, woff, ttf or otf file (up to 2 MB).</div>
        )}
        {fonts?.map(font => <FontRow key={font.id} font={font} onDelete={remove} />)}
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Only upload fonts you have the right to use. A font that an overlay uses can't be deleted until you pick another font there.
        </div>
      </FileSection>
    </div>
  );
}
