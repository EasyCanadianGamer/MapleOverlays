import { getToken } from './twitchAuth';

export const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export type OverlayKind = 'chat' | 'nowplaying';
export type OverlayConfig = Record<string, unknown>;

interface FieldBase { key: string; label: string; help?: string }
export type FieldDef =
  | (FieldBase & { type: 'number'; min: number; max: number; default: number })
  | (FieldBase & { type: 'boolean'; default: boolean })
  | (FieldBase & { type: 'color'; default: string })
  | (FieldBase & { type: 'select'; default: string; options: { value: string; label: string }[] })
  | (FieldBase & { type: 'text' | 'list'; default: string; maxLength: number })
  | (FieldBase & { type: 'font'; default: string });
export interface SectionDef { id: string; label: string; fields: FieldDef[] }

export interface OverlaySummary {
  id: string;
  kind: OverlayKind;
  name: string;
  description: string;
  token: string;
  updated_at: string;
}
export interface OverlayEditorData {
  id: string;
  kind: OverlayKind;
  name: string;
  description: string;
  config: OverlayConfig;
  token: string;
  schema: { sections: SectionDef[] };
}
export interface SavedOverlay {
  id: string;
  kind: OverlayKind;
  name: string;
  description: string;
  config: OverlayConfig;
  token: string;
}
export interface OverlayPatch { name?: string; description?: string; config?: OverlayConfig }
export interface PublicOverlay {
  kind: OverlayKind;
  config: OverlayConfig;
  channel: string;
  lastfm_username: string | null;
}
export interface UploadedFont {
  id: string; family: string; format: string; size_bytes: number;
  // Which overlays use this font. Sent when listing; a fresh upload has none.
  used_by?: { id: string; name: string }[];
}
export interface ChatAssets {
  badges: Record<string, string>;
  emotes: { sevenTv: Record<string, string>; bttv: Record<string, string>; ffz: Record<string, string> };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new ApiError(401, 'You are signed out. Log in again.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${apiUrl}${path}`, { ...init, headers });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* keep the generic message */ }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const listOverlays = () =>
  authed('/overlay-config').then(r => parse<OverlaySummary[]>(r));

export const createOverlay = (kind: OverlayKind) =>
  authed('/overlay-config', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ kind }) })
    .then(r => parse<OverlaySummary>(r));

export const duplicateOverlay = (id: string) =>
  authed(`/overlay-config/${enc(id)}/duplicate`, { method: 'POST' }).then(r => parse<OverlaySummary>(r));

export const getOverlay = (id: string) =>
  authed(`/overlay-config/${enc(id)}`).then(r => parse<OverlayEditorData>(r));

export const saveOverlay = (id: string, patch: OverlayPatch) =>
  authed(`/overlay-config/${enc(id)}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(patch) })
    .then(r => parse<SavedOverlay>(r));

export async function deleteOverlay(id: string): Promise<void> {
  const res = await authed(`/overlay-config/${enc(id)}`, { method: 'DELETE' });
  if (res.status === 204) return;
  await parse<unknown>(res);
}

export const rotateToken = (id: string) =>
  authed(`/overlay-config/${enc(id)}/token/rotate`, { method: 'POST' }).then(r => parse<{ token: string }>(r));

export async function getPublicOverlay(token: string): Promise<PublicOverlay | null> {
  const res = await fetch(`${apiUrl}/overlay-config/public/${enc(token)}`);
  if (res.status === 404) return null;
  return parse<PublicOverlay>(res);
}

export const listFonts = () => authed('/overlay-fonts').then(r => parse<UploadedFont[]>(r));

export const uploadFont = (file: File, family: string) =>
  authed(`/overlay-fonts?family=${enc(family)}&filename=${enc(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  }).then(r => parse<UploadedFont>(r));

export async function deleteFont(id: string): Promise<void> {
  const res = await authed(`/overlay-fonts/${enc(id)}`, { method: 'DELETE' });
  if (res.status === 204) return;
  await parse<unknown>(res);
}

export const fontFileUrl = (id: string) => `${apiUrl}/overlay-fonts/file/${enc(id)}`;

export async function getChatAssets(login: string): Promise<ChatAssets | null> {
  try {
    const res = await fetch(`${apiUrl}/chat-assets/${enc(login)}`);
    if (!res.ok) return null;
    return await res.json() as ChatAssets;
  } catch {
    return null;
  }
}

export const overlayUrl = (kind: OverlayKind, token: string) =>
  `${window.location.origin}/overlays/${kind}/${token}`;
