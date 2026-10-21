import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../ui/Button';

// Asked when someone leaves the editor with changes that are not saved yet.
export default function UnsavedDialog({ saving, error, onSave, onDiscard, onStay }: {
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onStay(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onStay]);

  return createPortal(
    <div
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget && !saving) onStay(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div
        role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title"
        style={{
          width: '100%', maxWidth: 420, padding: 24, background: 'var(--bg-2)', border: '1px solid var(--border-2)',
          borderRadius: 16, boxShadow: '0 24px 60px -12px rgba(0,0,0,.7)',
        }}
      >
        <div id="unsaved-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>You have unsaved changes</div>
        <div style={{ marginTop: 8, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>
          Do you want to save them before you leave?
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: '#e05252' }}>{error}</div>}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onStay} disabled={saving}>Keep editing</Button>
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>Don't save</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
