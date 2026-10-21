import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Renders its children inside a shadow root. The chat overlay's custom CSS is
// global by nature, so in the editor it must live in here: otherwise a rule
// such as `span { font-size: 40px }` would restyle the whole dashboard.
// @font-face rules are document-wide, so fonts still apply inside the shadow root.
export default function ShadowHost({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // attachShadow throws if called twice (React StrictMode runs effects twice in dev)
    setRoot(host.shadowRoot ?? host.attachShadow({ mode: 'open' }));
  }, []);

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
      {root ? createPortal(children, root) : null}
    </div>
  );
}
