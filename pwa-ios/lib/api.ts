const isLocalBrowser =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const BACKEND_URL = (
  isLocalBrowser
    ? 'http://localhost:8000'
    : process.env.NEXT_PUBLIC_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net:8443'
).replace(/\/+$/, '');

export const FACE_API_URL = (
  isLocalBrowser
    ? 'http://localhost:8001'
    : process.env.NEXT_PUBLIC_FACE_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net:10000'
).replace(/\/+$/, '');

export const ACTION_API_URL = (
  isLocalBrowser
    ? 'http://localhost:8002'
    : process.env.NEXT_PUBLIC_ACTION_API_URL || 'https://dat-latitude-5590-2.tail2bda46.ts.net'
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

export async function fetchDashboardState(penId?: string, userId?: string): Promise<any> {
  const qs = new URLSearchParams();
  if (penId) qs.set('pen_id', penId);
  if (userId) qs.set('user_id', userId);
  const query = qs.toString();
  const url = `${BACKEND_URL}/api/dashboard${query ? `?${query}` : ''}`;
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

export async function sendAgentChat(message: string, penId?: string, userId: string = 'ios_pwa_user'): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, pen_id: penId, user_id: userId }),
  });
  if (!res.ok) throw new Error(`Chat error ${res.status}`);
  return res.json();
}

export async function sendAgentChatStream(
  message: string,
  penId: string | undefined,
  callbacks: {
    onStatus?: (text: string) => void;
    onChunk: (delta: string) => void;
    onDone?: (fullReply: string, toolCalls: any[]) => void;
  },
  userId: string = 'ios_pwa_user'
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, pen_id: penId, user_id: userId }),
  });

  if (!res.ok || !res.body) {
    const fallback = await sendAgentChat(message, penId, userId);
    callbacks.onChunk(fallback.reply || 'Đã xử lý.');
    callbacks.onDone?.(fallback.reply || '', fallback.tool_calls || []);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullReply = '';
  let doneCalled = false;

  const processLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) return;
    try {
      const evt = JSON.parse(jsonStr);
      if (evt.type === 'status' && evt.text) {
        callbacks.onStatus?.(evt.text);
      } else if (evt.type === 'chunk' && evt.text) {
        fullReply += evt.text;
        callbacks.onChunk(evt.text);
      } else if (evt.type === 'done') {
        fullReply = evt.reply || fullReply;
        doneCalled = true;
        callbacks.onDone?.(fullReply, evt.tool_calls || []);
      } else if (evt.type === 'error') {
        throw new Error(evt.detail || 'Stream error');
      }
    } catch (e) {
      if (e instanceof SyntaxError) return;
      throw e;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  if (!doneCalled) {
    if (!fullReply) {
      const fallback = await sendAgentChat(message, penId);
      fullReply = fallback.reply || 'Đã xử lý.';
      callbacks.onChunk(fullReply);
      callbacks.onDone?.(fullReply, fallback.tool_calls || []);
    } else {
      callbacks.onDone?.(fullReply, []);
    }
  }
}

export interface DiagnosisResponse {
  category?: string;
  species?: string;
  disease_name?: string;
  text: string;
  answer: string;
  sources?: string[];
  timestamp?: string;
}

export function fileToBase64(
  file: File
): Promise<{ base64: string; contentType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({
        base64,
        contentType: file.type || 'image/jpeg',
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

export async function diagnoseDiseaseWithBase64(
  imageBase64?: string,
  userQuery?: string,
  contentType: string = 'image/jpeg',
  penId?: string,
  userId: string = 'ios_pwa_user'
): Promise<DiagnosisResponse> {
  const res = await fetch(`${BACKEND_URL}/api/diagnose/base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_query: userQuery || undefined,
      image_base64: imageBase64 || undefined,
      content_type: contentType,
      pen_id: penId || undefined,
      user_id: userId,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RAG Diagnosis error ${res.status}: ${errText}`);
  }
  return res.json();
}

export async function getChatHistory(userId: string = 'ios_pwa_user', penId?: string): Promise<any[]> {
  try {
    const url = new URL(`${BACKEND_URL}/api/chat/history`);
    url.searchParams.append('user_id', userId);
    if (penId) url.searchParams.append('pen_id', penId);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}

export interface NewsfeedItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  pen_id?: string;
  target_type?: string | null;
  target_id?: string | null;
  timestamp: string;
  action_label: string;
  action_route: string;
  is_resolved?: boolean;
  quick_api?: {
    method: string;
    endpoint: string;
    body: Record<string, any>;
  } | null;
}

export interface NewsfeedState {
  summary_text: string;
  briefing_text?: string | null;
  pending_tasks_count: number;
  low_stock_count: number;
  sick_animals_count: number;
  updated_at?: string;
  items: NewsfeedItem[];
}

export async function fetchNewsfeedState(limit: number = 12, userId?: string): Promise<NewsfeedState | null> {
  try {
    const url = new URL(`${BACKEND_URL}/api/newsfeed`);
    url.searchParams.set('limit', String(limit));
    if (userId) url.searchParams.set('user_id', userId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      summary_text: data.summary_text || '',
      briefing_text: data.briefing_text ?? null,
      pending_tasks_count: Number(data.pending_tasks_count ?? 0),
      low_stock_count: Number(data.low_stock_count ?? 0),
      sick_animals_count: Number(data.sick_animals_count ?? 0),
      updated_at: data.updated_at,
      items: data.items || [],
    };
  } catch {
    return null;
  }
}

export async function fetchNewsfeed(limit: number = 10, userId?: string): Promise<NewsfeedItem[]> {
  const state = await fetchNewsfeedState(limit, userId);
  return state?.items || [];
}

export async function executeNewsfeedQuickApi(
  endpoint: string,
  body: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Quick action error ${res.status}`);
  return res.json();
}

export async function triggerDailyBriefing(): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/briefing/daily`, { method: 'POST' });
  if (!res.ok) throw new Error(`Briefing error ${res.status}`);
  return res.json();
}

export async function updatePenMetadataAPI(
  penId: string,
  updates: { name?: string; type?: string; camera_url?: string; webcam_url?: string }
): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/pens/${encodeURIComponent(penId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Pen update error ${res.status}`);
  return res.json();
}

export async function getStaffList(): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function getStaffAttendanceHistory(limit = 30): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/attendance?limit=${limit}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function checkInStaff(payload: {
  staffId: string;
  staffName: string;
  penId: string;
  checkType: 'check_in' | 'check_out';
  note?: string;
}): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/staff/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: payload.staffId,
      staff_name: payload.staffName,
      pen_id: payload.penId,
      check_type: payload.checkType,
      note: payload.note || 'Chấm công thủ công (PWA)',
    }),
  });
  if (!res.ok) throw new Error(`Attendance error ${res.status}`);
  return res.json();
}

export async function enrollStaffFace(opts: {
  staffId: string;
  staffName: string;
  role: string;
  penId: string;
  fileThang: File;
  fileTrai?: File | null;
  filePhai?: File | null;
}): Promise<any> {
  const formData = new FormData();
  formData.append('staff_id', opts.staffId.trim().toUpperCase());
  formData.append('staff_name', opts.staffName.trim());
  formData.append('role', opts.role || 'Kỹ thuật viên');
  formData.append('pen_id', opts.penId || '123');
  if (opts.fileThang && opts.fileTrai && opts.filePhai) {
    formData.append('file_thang', opts.fileThang);
    formData.append('file_nghieng_trai', opts.fileTrai);
    formData.append('file_nghieng_phai', opts.filePhai);
  } else {
    formData.append('file', opts.fileThang);
  }
  const res = await fetch(`${BACKEND_URL}/api/staff/enroll`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Enroll error ${res.status}`);
  }
  return res.json();
}

export async function triggerOfficeSummaryAPI(targetDate?: string, userId?: string | null): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/office/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_date: targetDate || undefined, user_id: userId || undefined }),
  });
  if (!res.ok) throw new Error(`Office summarize error ${res.status}`);
  return res.json();
}

export async function updateStaffWageAPI(staffId: string, dailyWage: number): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/staff/${encodeURIComponent(staffId)}/wage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_wage: dailyWage }),
  });
  if (!res.ok) throw new Error(`Update wage error ${res.status}`);
  return res.json();
}
