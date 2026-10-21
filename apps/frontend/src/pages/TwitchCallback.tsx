import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseCallbackFragment, storeToken, fetchTwitchUser, storeUser } from '../lib/twitchAuth';

export default function TwitchCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseCallbackFragment();
    if (!parsed) {
      setError('No access_token in callback URL.');
      return;
    }
    const { token, state, expiresIn } = parsed;
    const expectedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    if (!state || state !== expectedState) {
      setError('OAuth state mismatch. Please try again.');
      return;
    }
    storeToken(token, expiresIn);
    fetchTwitchUser(token)
      .then(user => {
        storeUser(user);
        navigate('/dashboard', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      });
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
      }}
    >
      {error ? (
        <div style={{ color: '#F4526A', textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>Connection failed</div>
          <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>{error}</div>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 20,
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid var(--border-2)',
              background: 'var(--bg-2)',
              color: 'var(--ink-1)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            ← Go back
          </button>
        </div>
      ) : (
        <div style={{ color: 'var(--ink-2)' }}>Connecting to Twitch…</div>
      )}
    </div>
  );
}
