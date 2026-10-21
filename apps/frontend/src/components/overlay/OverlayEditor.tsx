import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Eyebrow from '../ui/Eyebrow';
import Button from '../ui/Button';
import SettingsPanel from './SettingsPanel';
import UnsavedDialog from './UnsavedDialog';
import {
  getOverlay, overlayUrl, rotateToken, saveOverlay,
  type OverlayConfig, type OverlayKind, type SectionDef,
} from '../../lib/overlayApi';

interface OverlayEditorProps {
  id: string;
  renderPreview: (kind: OverlayKind, config: OverlayConfig) => ReactNode;
  renderExtras?: (kind: OverlayKind) => ReactNode;
}

interface Fields { name: string; description: string; config: OverlayConfig }

const KIND_COPY: Record<OverlayKind, { eyebrow: string; subtitle: string }> = {
  chat: {
    eyebrow: 'Chat overlay',
    subtitle: 'Everything starts blank and plain. Change anything and watch the preview, then add the URL to OBS.',
  },
  nowplaying: {
    eyebrow: 'Now Playing overlay',
    subtitle: 'Pick the look, then add the URL to OBS. The card pops up on a new song, or when someone types !song.',
  },
};

const CHECKERBOARD = 'repeating-conic-gradient(#2b2b2b 0% 25%, #222 0% 50%) 50% / 24px 24px';

const inputStyle: CSSProperties = {
  height: 36, padding: '0 12px', borderRadius: 10, background: 'var(--bg-1)',
  border: '1px solid var(--border-2)', color: 'var(--ink-0)', outline: 'none',
  fontFamily: 'var(--font-body)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const labelStyle: CSSProperties = { fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 };

function BackLink() {
  return <Link to="/dashboard/overlays" style={{ color: 'var(--maple-300)', fontSize: 13, textDecoration: 'none' }}>← Back to overlays</Link>;
}

export default function OverlayEditor({ id, renderPreview, renderExtras }: OverlayEditorProps) {
  const [kind, setKind] = useState<OverlayKind | null>(null);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [saved, setSaved] = useState<Fields | null>(null);
  const [draft, setDraft] = useState<Fields | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getOverlay(id)
      .then(data => {
        if (cancelled) return;
        const fields: Fields = { name: data.name, description: data.description, config: data.config };
        setKind(data.kind);
        setSections(data.schema.sections);
        setSaved(fields);
        setDraft(fields);
        setToken(data.token);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.'); });
    return () => { cancelled = true; };
  }, [id]);

  const dirty = useMemo(
    () => saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  // Leaving with unsaved changes: closing the tab or reloading gets the browser's own prompt,
  // and any move inside the app (sidebar, links, the back button) asks "save or don't save" first.
  const navigate = useNavigate();
  const allowLeave = useRef(false); // set once the user chose Save, so that one move is not blocked again
  const blocker = useBlocker(() => dirty && !allowLeave.current);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const notify = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 2200);
  };

  if (error && !draft) {
    return (
      <Card style={{ padding: 22 }}>
        <BackLink />
        <div style={{ marginTop: 12, color: 'var(--ink-1)', fontSize: 14 }}>{error}</div>
      </Card>
    );
  }
  if (!draft || !saved || !kind) return <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Loading…</div>;

  const copy = KIND_COPY[kind];
  const url = token ? overlayUrl(kind, token) : '';
  const nameInvalid = draft.name.trim() === '';
  const patch = (change: Partial<Fields>) => setDraft({ ...draft, ...change });

  const save = async (): Promise<boolean> => {
    if (nameInvalid) return false;
    setSaving(true);
    setError(null);
    try {
      const result = await saveOverlay(id, { name: draft.name, description: draft.description, config: draft.config });
      const fields: Fields = { name: result.name, description: result.description, config: result.config };
      setSaved(fields);
      setDraft(fields);
      notify('Saved');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    patch({ config: Object.fromEntries(sections.flatMap(s => s.fields).map(f => [f.key, f.default])) });
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify('URL copied');
    } catch {
      window.prompt('Copy this URL', url);
    }
  };

  const rotate = async () => {
    if (!window.confirm('Create a new URL? The current one stops working, so you will need to update the browser source in OBS.')) return;
    try {
      const result = await rotateToken(id);
      setToken(result.token);
      notify('New URL created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create a new URL.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {blocker.state === 'blocked' && (
        <UnsavedDialog
          saving={saving}
          error={error}
          onSave={async () => {
            const to = blocker.location;
            if (to && await save()) { allowLeave.current = true; navigate(to); }
          }}
          onDiscard={() => blocker.proceed()}
          onStay={() => blocker.reset()}
        />
      )}
      <div>
        <BackLink />
        <div style={{ marginTop: 12 }}><Eyebrow>{copy.eyebrow}</Eyebrow></div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>{saved.name}</h2>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>{copy.subtitle}</div>
      </div>

      <div className="editor-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 22 }}>
            <Eyebrow>Info</Eyebrow>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Overlay name</span>
                <input style={inputStyle} maxLength={60} value={draft.name} onChange={e => patch({ name: e.target.value })} />
                {nameInvalid && <span style={{ fontSize: 11, color: '#e05252' }}>A name is required.</span>}
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Overlay description</span>
                <input style={inputStyle} maxLength={300} value={draft.description} onChange={e => patch({ description: e.target.value })} />
              </label>
            </div>
          </Card>

          <SettingsPanel sections={sections} value={draft.config} onChange={(key, v) => patch({ config: { ...draft.config, [key]: v } })} />
          {renderExtras?.(kind)}
        </div>

        <div className="editor-aside">
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px' }}><Eyebrow>Live preview</Eyebrow></div>
            {/* The transform makes this box the containing block for the overlay's position:fixed layer. */}
            <div style={{ position: 'relative', height: 360, overflow: 'hidden', transform: 'translateZ(0)', background: CHECKERBOARD }}>
              {renderPreview(kind, draft.config)}
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <Eyebrow>OBS browser source</Eyebrow>
            <input
              readOnly value={url} onFocus={e => e.currentTarget.select()}
              style={{ ...inputStyle, marginTop: 10, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" icon="copy" onClick={copyUrl}>Copy URL</Button>
              <Button variant="ghost" size="sm" icon="refresh" onClick={rotate}>New URL</Button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Add it to OBS as a Browser Source (1920 × 1080). Anyone with this URL can see the overlay, so treat it like a stream key for the page.
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant={flash === 'Saved' ? 'success' : 'primary'} size="sm" onClick={() => void save()} disabled={saving || !dirty || nameInvalid}>
                {saving ? 'Saving…' : flash === 'Saved' ? 'Saved!' : 'Save changes'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={!dirty}>Discard</Button>
              <Button variant="ghost" size="sm" onClick={resetToDefaults}>Reset settings</Button>
            </div>
            {flash && flash !== 'Saved' && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)' }}>{flash}</div>}
            {error && <div style={{ marginTop: 8, fontSize: 12, color: '#e05252' }}>{error}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
