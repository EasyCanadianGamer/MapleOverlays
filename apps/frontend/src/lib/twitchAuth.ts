const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined;

// Falls back to the current origin so dev port changes (5173, 5174, 5175…) never cause a redirect_mismatch.
// In production, set VITE_TWITCH_REDIRECT_URI explicitly and register that exact URL on dev.twitch.tv.
function getRedirectUri(): string {
  return (import.meta.env.VITE_TWITCH_REDIRECT_URI as string | undefined)
    ?? `${window.location.origin}/auth/twitch/callback`;
}

const SCOPES = [
  'chat:read',
  'chat:edit',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'moderator:read:followers',
  'channel:manage:broadcast',
  'bits:read',
];

const TOKEN_KEY = 'twitch_access_token';
const USER_KEY = 'twitch_user';
const EXPIRES_AT_KEY = 'twitch_token_expires_at';

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export function getCallbackUri(): string {
  return getRedirectUri();
}

export function buildAuthUrl(): string {
  if (!CLIENT_ID) throw new Error('VITE_TWITCH_CLIENT_ID is not set');
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  sessionStorage.setItem('oauth_state', state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'token',
    scope: SCOPES.join(' '),
    force_verify: 'true',
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export function buildBotAuthUrl(): string {
  if (!CLIENT_ID) throw new Error('VITE_TWITCH_CLIENT_ID is not set');
  const apiUrl = import.meta.env.VITE_API_URL as string;
  if (!apiUrl) throw new Error('VITE_API_URL is not set');
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  sessionStorage.setItem('bot_oauth_state', state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${apiUrl}/auth/bot/callback`,
    response_type: 'code',
    scope: 'channel:bot',
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export function parseCallbackFragment(): { token: string; state: string; expiresIn?: number } | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const state = params.get('state');
  if (!token || !state) return null;
  const expiresIn = params.get('expires_in');
  return { token, state, expiresIn: expiresIn ? Number(expiresIn) : undefined };
}

export function storeToken(token: string, expiresIn?: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresIn != null) {
    localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
  }
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  if (expiresAt && Date.now() > Number(expiresAt)) {
    clearAuth();
    return null;
  }
  return token;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

export async function fetchTwitchUser(token: string): Promise<TwitchUser> {
  if (!CLIENT_ID) throw new Error('VITE_TWITCH_CLIENT_ID is not set');
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': CLIENT_ID,
    },
  });
  if (!res.ok) throw new Error(`Twitch API error: ${res.status}`);
  const json = await res.json() as { data: TwitchUser[] };
  const user = json.data[0];
  if (!user) throw new Error('No user returned from Twitch');
  return user;
}

export function storeUser(user: TwitchUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): TwitchUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwitchUser;
  } catch {
    return null;
  }
}
