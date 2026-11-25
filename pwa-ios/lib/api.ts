export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net:8443'
).replace(/\/+$/, '');

export const FACE_API_URL = (
  process.env.NEXT_PUBLIC_FACE_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net:10000'
).replace(/\/+$/, '');

export const ACTION_API_URL = (
  process.env.NEXT_PUBLIC_ACTION_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net'
).replace(/\/+$/, '');

function toWsBase(httpUrl: string): string {
  return httpUrl.startsWith('https://')
    ? httpUrl.replace(/^https:\/\//i, 'wss://')
    : httpUrl.replace(/^http:\/\//i, 'ws://');
}

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `${toWsBase(BACKEND_URL)}/ws`;
export const FACE_WS_URL = toWsBase(FACE_API_URL);
export const ACTION_WS_URL = toWsBase(ACTION_API_URL);

export function getActionVideoWsUrl(targetId: string, streamType: 'ipcam' | 'webcam', source?: string): string {
  const params = new URLSearchParams({
    target_id: targetId || 'DEFAULT',
    stream_type: streamType,
  });
  if (source && source.trim()) {
    params.set('source', source.trim());
  }
  return `${ACTION_WS_URL}/ws/video_feed?${params.toString()}`;
}

export function getFaceVideoWsUrl(overlay: boolean = true): string {
  return `${FACE_WS_URL}/api/v1/camera/ws?overlay=${overlay ? 'true' : 'false'}`;
}

export interface PenItem {
  id: string;
  name: string;
  type: string;
  camera_url?: string;
  webcam_url?: string;
}

export async function fetchDashboardState(penId?: string): Promise<any> {
  const url = penId
    ? `${BACKEND_URL}/api/dashboard?pen_id=${encodeURIComponent(penId)}`
    : `${BACKEND_URL}/api/dashboard`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function controlDevice(
  deviceType: string,
  state: boolean,
  penId?: string
): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/devices/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_type: deviceType, state, pen_id: penId }),
  });
  if (!res.ok) throw new Error(`Device control error ${res.status}`);
  return res.json();
}

export async function getActionTrackerStatus(targetId: string, streamType: string = 'ipcam'): Promise<any> {
  try {
    const res = await fetch(
      `${ACTION_API_URL}/api/tracker/status?target_id=${encodeURIComponent(targetId)}&stream_type=${encodeURIComponent(streamType)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getActionLogs(targetId?: string, limit = 10): Promise<any[]> {
  try {
    const url = targetId
      ? `${ACTION_API_URL}/api/actions/logs?target_id=${encodeURIComponent(targetId)}&limit=${limit}`
      : `${ACTION_API_URL}/api/actions/logs?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function stopActionCamera(targetId: string): Promise<void> {
  try {
    await fetch(`${ACTION_API_URL}/api/camera/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, stream_type: 'all' }),
    });
  } catch {}
}

export async function configureActionCamera(
  targetId: string,
  source: string,
  streamType: 'ipcam' | 'webcam'
): Promise<any> {
  const res = await fetch(`${ACTION_API_URL}/api/camera/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId, source, stream_type: streamType }),
  });
  return res.json();
}

export async function startFaceCamera(source = '0'): Promise<any> {
  const res = await fetch(`${FACE_API_URL}/api/v1/camera/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, weekday_override: -1 }),
  });
  return res.json();
}

export async function stopFaceCamera(): Promise<void> {
  try {
    await fetch(`${FACE_API_URL}/api/v1/camera/stop`, { method: 'POST' });
  } catch {}
}

export async function getFaceCameraLatest(): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/camera/latest`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function sendAgentChat(message: string, penId?: string): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, pen_id: penId, user_id: 'ios_pwa_user' }),
  });
  if (!res.ok) throw new Error(`Chat error ${res.status}`);
  return res.json();
}
