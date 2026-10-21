import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Eyebrow from '../components/ui/Eyebrow';
import Icon from '../components/ui/Icon';
import {
  createOverlay, deleteOverlay, duplicateOverlay, listOverlays, overlayUrl,
  type OverlayKind, type OverlaySummary,
} from '../lib/overlayApi';

const KIND_LABEL: Record<OverlayKind, string> = { chat: 'Chat', nowplaying: 'Now Playing' };
const KIND_ICON: Record<OverlayKind, string> = { chat: 'chat', nowplaying: 'music' };
const ADD_OPTIONS: { kind: OverlayKind; label: string; hint: string }[] = [
  { kind: 'chat', label: 'Chat overlay', hint: 'Your Twitch chat, styled your way' },
  { kind: 'nowplaying', label: 'Now Playing overlay', hint: 'The track playing on Last.fm' },
];

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export default function OverlaysHome() {
  const navigate = useNavigate();
  const [overlays, setOverlays] = useState<OverlaySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOverlays()
      .then(list => { if (!cancelled) setOverlays(list); })
      .catch(err => { if (!cancelled) setError(message(err, 'Could not load your overlays.')); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menuOpen]);

  const tell = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
  };

  const add = async (kind: OverlayKind) => {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const created = await createOverlay(kind);
      navigate(`/dashboard/overlays/${created.id}`);
    } catch (err) {
      setError(message(err, 'Could not create the overlay.'));
      setBusy(false);
    }
  };

  const duplicate = async (overlay: OverlaySummary) => {
    setError(null);
    try {
      const copy = await duplicateOverlay(overlay.id);
      setOverlays(prev => [...(prev ?? []), copy]);
      tell(`Created "${copy.name}"`);
    } catch (err) {
      setError(message(err, 'Could not duplicate the overlay.'));
    }
  };

  const remove = async (overlay: OverlaySummary) => {
    if (!window.confirm(`Delete "${overlay.name}"? Its OBS URL stops working immediately.`)) return;
    setError(null);
    try {
      await deleteOverlay(overlay.id);
      setOverlays(prev => (prev ?? []).filter(o => o.id !== overlay.id));
    } catch (err) {
      setError(message(err, 'Could not delete the overlay.'));
    }
  };

  const copyUrl = async (overlay: OverlaySummary) => {
    const url = overlayUrl(overlay.kind, overlay.token);
    try {
      await navigator.clipboard.writeText(url);
      tell('URL copied');
    } catch {
      window.prompt('Copy this URL', url);
    }
  };

  const toggleMenu = () => {
    if (menuOpen) { setMenuOpen(false); return; }
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const area = document.querySelector('main')?.getBoundingClientRect();
    const minLeft = (area?.left ?? 0) + 12;
    const maxRight = (area?.right ?? window.innerWidth) - 12;
    const width = Math.max(220, Math.min(300, maxRight - minLeft));
    const left = Math.min(Math.max(button.right - width, minLeft), maxRight - width);
    setMenuPos({ left, top: button.bottom + 8, width });
    setMenuOpen(true);
  };

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
    border: 0, background: 'transparent', color: 'var(--ink-0)', textAlign: 'left',
    fontFamily: 'var(--font-body)', cursor: 'pointer', borderRadius: 10,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <Eyebrow>Overlays</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>Your overlays.</h2>
          <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
            Make as many chat and Now Playing overlays as you like. Each has its own look and its own OBS URL.
          </div>
        </div>

        <div ref={buttonRef} style={{ flex: 'none', display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => navigate('/dashboard/overlays/files')}>Files</Button>
          <Button icon="plus" onClick={toggleMenu} disabled={busy} aria-haspopup="menu" aria-expanded={menuOpen}>
            Add overlay
          </Button>
        </div>
      </div>

      {menuOpen && menuPos && createPortal(
        <div ref={menuRef} role="menu" style={{
          position: 'fixed', left: menuPos.left, top: menuPos.top, width: menuPos.width, zIndex: 1000, padding: 6,
          background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 14,
          boxShadow: '0 16px 40px -12px rgba(0,0,0,.6)',
        }}>
          {ADD_OPTIONS.map(option => (
            <button
              key={option.kind} role="menuitem" style={menuItem} onClick={() => add(option.kind)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name={KIND_ICON[option.kind]} size={18} />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{option.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)' }}>{option.hint}</span>
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {error && (
        <Card style={{ padding: 16, borderColor: 'rgba(224,82,82,.4)' }}>
          <div style={{ fontSize: 14, color: '#e05252' }}>{error}</div>
          {error.includes('Invite the bot') && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <Link to="/dashboard/bot/settings" style={{ color: 'var(--maple-300)' }}>Go to Bot settings</Link> to invite the bot first.
            </div>
          )}
        </Card>
      )}
      {notice && <div style={{ fontSize: 13, color: 'var(--success)' }}>{notice}</div>}

      {overlays === null && !error && <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Loading…</div>}

      {overlays !== null && overlays.length === 0 && (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>No overlays yet</div>
          <div style={{ marginTop: 6, color: 'var(--ink-2)', fontSize: 14 }}>
            Click <strong>Add overlay</strong> to make your first chat or Now Playing overlay.
          </div>
        </Card>
      )}

      {overlays !== null && overlays.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {overlays.map(overlay => (
            <Card key={overlay.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--maple-300)' }}>
                <Icon name={KIND_ICON[overlay.kind]} size={16} />
                <Eyebrow>{KIND_LABEL[overlay.kind]}</Eyebrow>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, wordBreak: 'break-word' }}>{overlay.name}</div>
              {overlay.description && <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>{overlay.description}</div>}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                Updated {new Date(overlay.updated_at).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                <Button size="sm" onClick={() => navigate(`/dashboard/overlays/${overlay.id}`)}>Edit</Button>
                <Button size="sm" variant="secondary" icon="copy" onClick={() => copyUrl(overlay)}>Copy URL</Button>
                <Button size="sm" variant="secondary" onClick={() => duplicate(overlay)}>Duplicate</Button>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(overlay)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
