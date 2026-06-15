import { useState } from 'react';
import MapleMark from '../components/ui/MapleMark';
import { buildAuthUrl, getCallbackUri } from '../lib/twitchAuth';

export default function AuthGate() {
  const [error, setError] = useState<string | null>(null);
  const clientIdMissing = !import.meta.env.VITE_TWITCH_CLIENT_ID;

  const handleConnect = () => {
    try {
      window.location.href = buildAuthUrl();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build auth URL');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        backgroundImage: 'url(/pattern-leaves.svg)',
        backgroundSize: '240px 240px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          padding: '48px 40px',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 20,
          boxShadow: '0 40px 80px -20px rgba(0,0,0,.6)',
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <MapleMark size={44} />

        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: '-0.025em',
              color: 'var(--ink-0)',
              margin: '0 0 10px',
            }}
          >
            Plug in. Go live.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
            Connect your Twitch account to get started.
          </p>
        </div>

        {clientIdMissing ? (
          <div
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(244,82,106,.08)',
              border: '1px solid rgba(244,82,106,.25)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#F4526A',
              textAlign: 'left',
              lineHeight: 1.8,
            }}
          >
            <strong>VITE_TWITCH_CLIENT_ID</strong> is not set.<br />
            1. Create an app at{' '}
            <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#F4526A' }}>
              dev.twitch.tv
            </a><br />
            2. Add this OAuth Redirect URL:<br />
            <span
              style={{
                display: 'block',
                marginTop: 4,
                padding: '4px 8px',
                background: 'rgba(0,0,0,.3)',
                borderRadius: 6,
                color: '#ffcdd5',
                userSelect: 'all',
              }}
            >
              {getCallbackUri()}
            </span>
            3. Copy <code>.env.example</code> → <code>.env</code> and set <strong>VITE_TWITCH_CLIENT_ID</strong>
          </div>
        ) : (
          <>
            <button
              onClick={handleConnect}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: '1px solid rgba(169,112,255,.4)',
                background: 'rgba(169,112,255,.14)',
                color: '#c6a4ff',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'background .12s var(--ease-out), border-color .12s var(--ease-out)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(169,112,255,.22)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(169,112,255,.6)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(169,112,255,.14)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(169,112,255,.4)';
              }}
            >
              {/* Twitch wordmark glyph */}
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
              </svg>
              Sign in with Twitch
            </button>

            {error && (
              <div style={{ fontSize: 12, color: '#F4526A', fontFamily: 'var(--font-mono)' }}>
                {error}
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          Self-hosting?{' '}
          <a
            href="https://github.com/EasyCanadianGamer/MapleOverlays"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}
          >
            View the setup guide.
          </a>
        </div>
      </div>
    </div>
  );
}
