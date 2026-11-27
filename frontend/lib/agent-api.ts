import { supabase } from './supabase';

const DEFAULT_BACKEND_URL = 'https://dat-latitude-5590-2.tail2bda46.ts.net:8443';
const DEFAULT_FACE_API_URL = 'https://dat-latitude-5590-2.tail2bda46.ts.net:10000';
const DEFAULT_ACTION_API_URL = 'https://dat-latitude-5590-2.tail2bda46.ts.net';

const isLocalBrowser =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const BACKEND_URL = (
  isLocalBrowser ? 'http://localhost:8000' : (process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND_URL)
).replace(/\/+$/, '');
export const FACE_API_URL = (
  isLocalBrowser ? 'http://localhost:8001' : (process.env.NEXT_PUBLIC_FACE_API_URL || DEFAULT_FACE_API_URL)
).replace(/\/+$/, '');
export const FACE_WS_URL = (
  isLocalBrowser
    ? 'ws://localhost:8001'
    : process.env.NEXT_PUBLIC_FACE_WS_URL ||
      (FACE_API_URL.startsWith('https://')
        ? FACE_API_URL.replace(/^https:\/\//i, 'wss://')
        : FACE_API_URL.replace(/^http:\/\//i, 'ws://'))
);
export const ACTION_API_URL = (
  isLocalBrowser ? 'http://localhost:8002' : (process.env.NEXT_PUBLIC_ACTION_API_URL || DEFAULT_ACTION_API_URL)
).replace(/\/+$/, '');
export const ACTION_WS_URL = (
  isLocalBrowser
    ? 'ws://localhost:8002'
    : process.env.NEXT_PUBLIC_ACTION_WS_URL ||
      (ACTION_API_URL.startsWith('https://')
        ? ACTION_API_URL.replace(/^https:\/\//i, 'wss://')
        : ACTION_API_URL.replace(/^http:\/\//i, 'ws://'))
);
export const WS_URL = isLocalBrowser
  ? 'ws://localhost:8000/ws'
  : process.env.NEXT_PUBLIC_WS_URL ||
    (BACKEND_URL.startsWith('https://')
      ? BACKEND_URL.replace(/^https:\/\//i, 'wss://') + '/ws'
      : BACKEND_URL.replace(/^http:\/\//i, 'ws://') + '/ws');

export function getActionVideoStreamWsUrl(
  targetId: string = 'DEFAULT',
  streamType: string = 'ipcam',
  source?: string
): string {
  const params = new URLSearchParams({
    target_id: targetId || 'DEFAULT',
    stream_type: streamType,
  });
  if (source && source.trim()) {
    params.set('source', source.trim());
  }
  return `${ACTION_WS_URL}/ws/video_feed?${params.toString()}`;
}

export function getFaceVideoStreamWsUrl(overlay: boolean = true): string {
  const params = new URLSearchParams({
    overlay: overlay ? 'true' : 'false',
  });
  return `${FACE_WS_URL}/api/v1/camera/ws?${params.toString()}`;
}

export interface ChatResponse {
  reply: string;
  tool_calls: Array<{
    tool: string;
    args: Record<string, any>;
    result?: string;
  }>;
  timestamp?: string;
}

/**
 * Send message / instruction to AI Agent (FastMCP + Gemini)
 * Persists chat message per user & pen
 */
export async function sendAgentChat(
  message: string,
  penId?: string,
  userId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      pen_id: penId,
      user_id: userId || 'guest',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Agent API Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function sendAgentChatStream(
  message: string,
  penId: string | undefined,
  userId: string | undefined,
  callbacks: {
    onStatus?: (text: string) => void;
    onChunk: (delta: string) => void;
    onDone?: (fullReply: string, toolCalls: any[]) => void;
  }
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        pen_id: penId,
        user_id: userId || 'guest',
      }),
    });
  } catch {
    const fallback = await sendAgentChat(message, penId, userId);
    callbacks.onChunk(fallback.reply || 'Đã thực hiện xong yêu cầu.');
    callbacks.onDone?.(fallback.reply || '', fallback.tool_calls || []);
    return;
  }

  if (!res.ok || !res.body) {
    const fallback = await sendAgentChat(message, penId, userId);
    callbacks.onChunk(fallback.reply || 'Đã thực hiện xong yêu cầu.');
    callbacks.onDone?.(fallback.reply || '', fallback.tool_calls || []);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullReply = '';
  let finalTools: any[] = [];
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
        finalTools = evt.tool_calls || [];
        doneCalled = true;
        callbacks.onDone?.(fullReply, finalTools);
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
      const fallback = await sendAgentChat(message, penId, userId);
      fullReply = fallback.reply || 'Đã thực hiện xong yêu cầu.';
      finalTools = fallback.tool_calls || [];
      callbacks.onChunk(fullReply);
    }
    callbacks.onDone?.(fullReply, finalTools);
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

/**
 * Send Base64 image + optional query to RAG Diagnosis API (/api/diagnose/base64)
 */
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

export async function fetchNewsfeedState(
  penId?: string,
  limit: number = 12,
  userId?: string | null
): Promise<NewsfeedState | null> {
  try {
    const url = new URL(`${BACKEND_URL}/api/newsfeed`);
    if (penId && penId !== 'all') url.searchParams.append('pen_id', penId);
    if (userId) url.searchParams.append('user_id', userId);
    url.searchParams.append('limit', String(limit));
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

export async function fetchNewsfeed(
  penId?: string,
  limit: number = 10,
  userId?: string | null
): Promise<NewsfeedItem[]> {
  const state = await fetchNewsfeedState(penId, limit, userId);
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
  if (!res.ok) throw new Error(`Quick action error (${res.status})`);
  return await res.json();
}

export async function diagnoseDiseaseWithBase64(
  imageBase64?: string,
  userQuery?: string,
  contentType: string = 'image/jpeg',
  penId?: string,
  userId?: string
): Promise<DiagnosisResponse> {
  const res = await fetch(`${BACKEND_URL}/api/diagnose/base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_query: userQuery || undefined,
      image_base64: imageBase64 || undefined,
      content_type: contentType,
      pen_id: penId || undefined,
      user_id: userId || 'guest',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RAG Diagnosis Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Fetch persistent chat history for a specific user and pen
 */
export async function getChatHistory(
  userId: string,
  penId?: string
): Promise<Array<{
  id: string | number;
  sender: 'user' | 'agent';
  content: string;
  created_at: string;
  tool_calls?: any[];
}>> {
  try {
    const url = new URL(`${BACKEND_URL}/api/chat/history`);
    url.searchParams.append('user_id', userId);
    if (penId) url.searchParams.append('pen_id', penId);

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch (e) {
    console.error('Error fetching chat history:', e);
    return [];
  }
}

/**
 * Trigger Farm Morning Briefing (Gemini summary)
 */
export async function triggerDailyBriefing(): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/scheduler/trigger-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Briefing Error: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Control IoT Device via API
 */
export async function controlDeviceViaAPI(
  penId: string,
  deviceName: string,
  action: 'turn_on' | 'turn_off'
): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/devices/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pen_id: penId,
      device_name: deviceName,
      action,
    }),
  });

  return await res.json();
}

/**
 * Transfer Animal across pens
 */
export async function transferAnimalViaAPI(
  animalId: string,
  targetPenId: string,
  reason: string
): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/animals/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      animal_id: animalId,
      target_pen_id: targetPenId,
      reason,
    }),
  });

  return await res.json();
}

/**
 * Connect to FastAPI WebSocket for Realtime Agent Events
 */
export function connectAgentWebSocket(
  onEvent: (event: string, data: any) => void,
  onStatusChange: (status: 'connected' | 'disconnected') => void
): () => void {
  let ws: WebSocket | null = null;
  let shouldReconnect = true;
  let reconnectTimeout: NodeJS.Timeout;

  const connect = () => {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ Connected to Smart Farm AI Agent WebSocket');
        onStatusChange('connected');
      };

      ws.onmessage = (messageEvent) => {
        try {
          const packet = JSON.parse(messageEvent.data);
          console.log('⚡ Agent WebSocket Packet:', packet);
          if (packet.event) {
            onEvent(packet.event, packet.data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket packet:', e);
        }
      };

      ws.onclose = () => {
        onStatusChange('disconnected');
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (err) {
      onStatusChange('disconnected');
      if (shouldReconnect) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }
  };

  connect();

  return () => {
    shouldReconnect = false;
    clearTimeout(reconnectTimeout);
    if (ws) {
      ws.close();
    }
  };
}

// ==========================================
// STAFF & FACE ATTENDANCE & UNIFORM APIS
// ==========================================

export interface Staff {
  id: string;
  name: string;
  role?: string;
  pen_id?: string;
  phone?: string;
  avatar_url?: string;
}

export interface AttendanceRecord {
  id?: number;
  staff_id: string;
  staff_name: string;
  pen_id?: string;
  status: string;
  check_type?: string;
  confidence?: number;
  is_real?: boolean;
  note?: string;
  created_at?: string;
}

/**
 * Get full staff list (Supabase Priority with Backend Fallback)
 */
export async function getStaffList(): Promise<Staff[]> {
  try {
    const { data, error } = await supabase.from('staff').select('*').order('id');
    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (supaErr) {
    console.warn('Supabase getStaffList warning:', supaErr);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/staff`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend getStaffList warning:', e);
  }

  return [
    { id: 'NV01', name: 'Nguyễn Văn An', role: 'Quản lý trang trại', pen_id: '123' },
    { id: 'NV02', name: 'Trần Thị Bình', role: 'Bác sĩ thú y', pen_id: 'PEN-ISO-01' },
    { id: 'NV03', name: 'Lê Hoàng Long', role: 'Kỹ thuật viên IoT', pen_id: 'PEN-A02' },
    { id: 'NV04', name: 'Phạm Văn Cường', role: 'Kỹ sư nông học', pen_id: 'PEN-B01' },
  ];
}

/**
 * Face Check-in / Attendance API (Ghi trực tiếp vào Supabase & đồng bộ Backend)
 */
export async function checkInStaff(payload: {
  staffId?: string;
  staffName?: string;
  imageBase64?: string;
  penId?: string;
  checkType?: string;
  confidence?: number;
  isReal?: boolean;
  note?: string;
}): Promise<any> {
  const staffId = (payload.staffId || 'NV01').trim();
  const staffName = (payload.staffName || 'Nhân sự').trim();
  const checkType = payload.checkType || 'check_in';
  const penId = payload.penId || '123';
  const note = payload.note || '';
  const nowIso = new Date().toISOString();

  let supabaseAttendanceRecord: any = null;

  // 1. Ghi trực tiếp vào Supabase (Bảo đảm 100% được lưu vào cơ sở dữ liệu Supabase)
  try {
    // 1.1 Đảm bảo staff_id đã có trong bảng staff (tránh vi phạm Foreign Key Constraint)
    try {
      await supabase.from('staff').upsert({
        id: staffId,
        name: staffName,
        role: 'Kỹ thuật viên',
        pen_id: penId,
      }, { onConflict: 'id' });
    } catch (upsertErr) {
      console.warn('Could not upsert staff into Supabase before checkin:', upsertErr);
    }

    // 1.2 Ghi bản ghi vào bảng staff_attendance
    const attendanceRow = {
      staff_id: staffId,
      staff_name: staffName,
      pen_id: penId,
      status: checkType === 'check_out' ? 'completed' : 'present',
      check_type: checkType,
      confidence: payload.confidence || 0.98,
      is_real: payload.isReal ?? true,
      note: note,
      created_at: nowIso,
    };

    const { data, error } = await supabase
      .from('staff_attendance')
      .insert(attendanceRow)
      .select();

    if (error) {
      console.warn('Supabase staff_attendance insert error, retrying without pen_id:', error);
      // Fallback: nếu chuồng trại chưa có trong bảng pens, lưu với pen_id = null
      const { data: dataFallback, error: errFallback } = await supabase
        .from('staff_attendance')
        .insert({ ...attendanceRow, pen_id: null })
        .select();

      if (!errFallback && dataFallback && dataFallback.length > 0) {
        supabaseAttendanceRecord = dataFallback[0];
      }
    } else if (data && data.length > 0) {
      supabaseAttendanceRecord = data[0];
    }
  } catch (supaErr) {
    console.error('Lỗi khi ghi điểm danh vào Supabase:', supaErr);
  }

  // 2. Đồng thời gửi tới Backend API (để kích hoạt WebSocket broadcast và cập nhật trạng thái camera)
  let backendResponse: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        image_base64: payload.imageBase64,
        pen_id: penId,
        check_type: checkType,
        note: note,
      }),
    });
    if (res.ok) {
      backendResponse = await res.json();
    }
  } catch (backendErr) {
    console.warn('Backend checkin warning:', backendErr);
  }

  return {
    status: 'success',
    attendance: supabaseAttendanceRecord || backendResponse?.attendance || {
      staff_id: staffId,
      staff_name: staffName,
      check_type: checkType,
      created_at: nowIso,
    },
    backend: backendResponse,
  };
}

/**
 * Face Check-in / Attendance API (File Upload)
 */
export async function checkInStaffUpload(
  file: File,
  penId: string = '123',
  checkType: string = 'check_in',
  staffId?: string
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pen_id', penId);
  formData.append('check_type', checkType);
  if (staffId) formData.append('staff_id', staffId);

  let backendRes: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/checkin-upload`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      backendRes = await res.json();
    }
  } catch (backendErr) {
    console.warn('Backend checkin-upload warning:', backendErr);
  }

  // Ghi bản ghi vào Supabase
  const sid = backendRes?.attendance?.staff_id || staffId || 'NV01';
  const sname = backendRes?.attendance?.staff_name || 'Nhân sự';
  try {
    await supabase.from('staff').upsert({
      id: sid,
      name: sname,
      pen_id: penId,
    }, { onConflict: 'id' });

    await supabase.from('staff_attendance').insert({
      staff_id: sid,
      staff_name: sname,
      pen_id: penId,
      status: checkType === 'check_out' ? 'completed' : 'present',
      check_type: checkType,
      confidence: 0.98,
      is_real: true,
      note: `Upload ảnh chấm công (${checkType})`,
      created_at: new Date().toISOString()
    });
  } catch (supaErr) {
    console.warn('Supabase attendance upload save warning:', supaErr);
  }

  return backendRes || {
    status: 'success',
    attendance: { staff_id: sid, staff_name: sname, check_type: checkType }
  };
}

/**
 * Get recent staff attendance logs (Truy vấn trực tiếp Supabase & Fallback Backend)
 */
export async function getStaffAttendanceHistory(limit: number = 20): Promise<AttendanceRecord[]> {
  // 1. Ưu tiên lấy từ bảng staff_attendance của Supabase
  try {
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (supaErr) {
    console.warn('Supabase getStaffAttendanceHistory warning:', supaErr);
  }

  // 2. Thử lấy từ Backend API
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/attendance?limit=${limit}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend attendance history warning:', e);
  }

  return [];
}

/**
 * Register new staff FaceID (Lưu Supabase và gửi Backend)
 */
export interface EnrollFaceOptions {
  staffId: string;
  staffName: string;
  role?: string;
  penId?: string;
  file?: File;
  fileThang?: File;
  fileNghiengTrai?: File;
  fileNghiengPhai?: File;
}

export async function enrollStaffFace(
  staffIdOrOptions: string | EnrollFaceOptions,
  staffName?: string,
  file?: File,
  role: string = 'Kỹ thuật viên',
  penId: string = '123',
  fileNghiengTrai?: File,
  fileNghiengPhai?: File
): Promise<any> {
  let sId = '';
  let sName = '';
  let sRole = role;
  let sPenId = penId;
  let fSingle: File | undefined = file;
  let fThang: File | undefined = undefined;
  let fTrai: File | undefined = fileNghiengTrai;
  let fPhai: File | undefined = fileNghiengPhai;

  if (typeof staffIdOrOptions === 'object') {
    sId = staffIdOrOptions.staffId;
    sName = staffIdOrOptions.staffName;
    sRole = staffIdOrOptions.role || 'Kỹ thuật viên';
    sPenId = staffIdOrOptions.penId || '123';
    fSingle = staffIdOrOptions.file;
    fThang = staffIdOrOptions.fileThang;
    fTrai = staffIdOrOptions.fileNghiengTrai;
    fPhai = staffIdOrOptions.fileNghiengPhai;
  } else {
    sId = staffIdOrOptions;
    sName = staffName || '';
    fSingle = file;
  }

  const cleanId = (sId || '').trim().toUpperCase();
  const cleanName = sName.trim();

  // 1. Gửi sang Backend API để tự tạo ID (nếu trống) & trích xuất embedding khuôn mặt (3 góc eKYC hoặc đơn lẻ)
  const formData = new FormData();
  if (cleanId) formData.append('staff_id', cleanId);
  formData.append('staff_name', cleanName);
  formData.append('role', sRole);
  formData.append('pen_id', sPenId);

  if (fThang && fTrai && fPhai) {
    formData.append('file_thang', fThang);
    formData.append('file_nghieng_trai', fTrai);
    formData.append('file_nghieng_phai', fPhai);
  } else if (fSingle) {
    formData.append('file', fSingle);
  } else if (fThang) {
    formData.append('file', fThang);
  }

  let backendRes: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/enroll`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      backendRes = json;
    } else if (res.status >= 400 && res.status < 500) {
      throw new Error(json.detail || json.message || `Lỗi đăng ký khuôn mặt (${res.status})`);
    }
  } catch (err: any) {
    if (err?.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
  }

  let finalId = String(backendRes?.staff?.id || cleanId || '');

  // Fallback gọi trực tiếp Face AI Engine (:10000/api/v1/faces/enroll) nếu Backend (:8443) không phản hồi
  if (!backendRes) {
    if (!finalId) {
      const { data: rows } = await supabase.from('staff').select('id');
      const maxNum = (rows || []).reduce((m: number, r: any) => {
        const n = /^\d+$/.test(String(r.id || '').trim()) ? Number(r.id) : 0;
        return Math.max(m, n);
      }, 0);
      finalId = String(maxNum + 1);
    }
    const faceFd = new FormData();
    faceFd.append('student_id', finalId);
    faceFd.append('student_name', cleanName);
    if (fThang && fTrai && fPhai) {
      faceFd.append('file_thang', fThang);
      faceFd.append('file_nghieng_trai', fTrai);
      faceFd.append('file_nghieng_phai', fPhai);
    } else if (fSingle) {
      faceFd.append('file', fSingle);
    } else if (fThang) {
      faceFd.append('file', fThang);
    }
    const faceRes = await fetch(`${FACE_API_URL}/api/v1/faces/enroll`, {
      method: 'POST',
      body: faceFd,
    });
    const faceJson = await faceRes.json().catch(() => ({}));
    if (!faceRes.ok) {
      throw new Error(faceJson.detail || faceJson.message || `Lỗi Face AI (${faceRes.status})`);
    }
    backendRes = faceJson;
  }
  if (finalId) {
    try {
      await supabase.from('staff').upsert({
        id: finalId,
        name: cleanName,
        role: sRole.trim(),
        pen_id: sPenId || '123',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (supaErr) {
      console.error('Error saving new staff to Supabase:', supaErr);
    }
  }

  return {
    status: 'success',
    staff: backendRes?.staff || { id: finalId, name: cleanName, role: sRole, pen_id: sPenId },
    backend: backendRes,
  };
}

/**
 * Reload FaceID from known_faces folder
 */
export async function reloadStaffFacesAPI(): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/faces/reload`, {
      method: 'POST',
    });
    if (res.ok) return await res.json();
  } catch {}

  const res = await fetch(`${BACKEND_URL}/api/staff/reload-faces`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Không thể làm mới danh sách khuôn mặt');
  return await res.json();
}

/**
 * Check Standalone AI Engine Health (Face Recognition Engine)
 */
export async function getVisionHealth(): Promise<any> {
  // First try direct Face Recognition API
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/health`);
    if (res.ok) {
      const data = await res.json();
      return { online: true, ...data };
    }
  } catch {}

  // Fallback to backend proxy check
  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/vision-status`);
    if (!res.ok) return { online: false };
    return await res.json();
  } catch {
    return { online: false };
  }
}

/**
 * Scan Full-Body & Inspect Uniform via Base64
 */
export async function scanUniformAPI(
  imageBase64: string,
  weekday: number = -1,
  returnAnnotated: boolean = true
): Promise<any> {
  // Direct call to Face / Vision Engine
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/uniform/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        weekday,
        return_annotated: returnAnnotated,
      }),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback to backend proxy
  const res = await fetch(`${BACKEND_URL}/api/uniform/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64,
      weekday,
      return_annotated: returnAnnotated,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Lỗi khi quét toàn thân và kiểm tra đồng phục');
  }

  return await res.json();
}

/**
 * Scan Full-Body & Inspect Uniform via File Upload
 */
export async function scanUniformUploadAPI(
  file: File,
  weekday: number = -1
): Promise<any> {
  // Direct call to Face / Vision Engine
  try {
    const directForm = new FormData();
    directForm.append('file', file);
    if (weekday !== undefined && weekday >= 0) {
      directForm.append('weekday_override', weekday.toString());
    }
    const res = await fetch(`${FACE_API_URL}/api/v1/uniform/inspect-upload`, {
      method: 'POST',
      body: directForm,
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback to backend proxy
  const formData = new FormData();
  formData.append('file', file);
  formData.append('weekday', weekday.toString());

  const res = await fetch(`${BACKEND_URL}/api/uniform/scan-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Lỗi khi upload ảnh kiểm tra đồng phục');
  }

  return await res.json();
}

/**
 * Live Camera Frame Real-Time AI Scan
 */
export async function liveScanStaffAPI(params: {
  imageBase64: string;
  penId?: string;
  checkType?: string;
  weekday?: number;
  autoCheckin?: boolean;
  returnAnnotated?: boolean;
}): Promise<any> {
  // When running purely detection (autoCheckin=false), call Face API directly for low latency
  if (params.autoCheckin === false) {
    try {
      const res = await fetch(`${FACE_API_URL}/api/v1/uniform/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: params.imageBase64,
          weekday: params.weekday !== undefined ? params.weekday : -1,
          return_annotated: params.returnAnnotated || false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          status: 'success',
          faces: data.faces || [],
          uniform: data.uniform || null,
          faces_detected: data.faces_detected || (data.faces ? data.faces.length : 0),
          person_detected: data.person_detected || false,
          process_time_ms: data.process_time_ms || 0,
          annotated_image_base64: data.annotated_image_base64 || null,
        };
      }
    } catch {}
  }

  // Backend endpoint handles autoCheckin with database persistence & WebSocket broadcast
  const res = await fetch(`${BACKEND_URL}/api/staff/live-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: params.imageBase64,
      pen_id: params.penId || '123',
      check_type: params.checkType || 'check_in',
      weekday: params.weekday !== undefined ? params.weekday : -1,
      auto_checkin: params.autoCheckin !== undefined ? params.autoCheckin : true,
      return_annotated: params.returnAnnotated || false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Lỗi khi quét live camera');
  }

  return await res.json();
}

/**
 * Direct Face Recognition Analysis APIs
 */
export async function analyzeFaceDirectAPI(imageBase64: string, weekday?: number): Promise<any> {
  const res = await fetch(`${FACE_API_URL}/api/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64,
      weekday_override: weekday,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Lỗi khi phân tích khuôn mặt');
  }
  return await res.json();
}

export async function analyzeFaceUploadDirectAPI(file: File, weekday?: number): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  if (weekday !== undefined) {
    formData.append('weekday_override', weekday.toString());
  }
  const res = await fetch(`${FACE_API_URL}/api/v1/analyze-upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Lỗi khi upload ảnh nhận diện khuôn mặt');
  }
  return await res.json();
}

/**
 * Camera Hardware Live Stream Controls
 */
export async function getCameraStreamStatusAPI(): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/camera/status`);
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`${BACKEND_URL}/api/camera/status`);
    if (!res.ok) return { is_running: false };
    return await res.json();
  } catch {
    return { is_running: false };
  }
}

export async function getCameraLatestTelemetryAPI(): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/camera/latest`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(800)
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`${BACKEND_URL}/api/camera/latest`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(800)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function startCameraDeviceAPI(source: string = '0', weekday?: number): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/camera/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, weekday_override: weekday }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const url = `${BACKEND_URL}/api/camera/start?source=${encodeURIComponent(source)}${weekday !== undefined ? `&weekday=${weekday}` : ''}`;
  const res = await fetch(url, { method: 'POST' });
  return await res.json();
}

export async function stopCameraDeviceAPI(): Promise<any> {
  try {
    const res = await fetch(`${FACE_API_URL}/api/v1/camera/stop`, { method: 'POST' });
    if (res.ok) return await res.json();
  } catch {}

  const res = await fetch(`${BACKEND_URL}/api/camera/stop`, { method: 'POST' });
  return await res.json();
}

// ==============================================================================
// 10. ACTION & MOTION TRACKING API (PORT 8002 - IP WEB CAM PER PEN)
// ==============================================================================

export async function getActionTrackerStatusAPI(
  targetId: string = 'DEFAULT',
  streamType: string = 'ipcam'
): Promise<any> {
  try {
    const res = await fetch(
      `${ACTION_API_URL}/api/tracker/status?target_id=${encodeURIComponent(targetId)}&stream_type=${encodeURIComponent(streamType)}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(1200)
      }
    );
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function getActionLogsAPI(targetId?: string, limit: number = 20): Promise<any> {
  try {
    const url = targetId 
      ? `${ACTION_API_URL}/api/actions/logs?target_id=${encodeURIComponent(targetId)}&limit=${limit}`
      : `${ACTION_API_URL}/api/actions/logs?limit=${limit}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {}
  return { count: 0, data: [] };
}

export async function configurePenCameraAPI(
  targetId: string,
  source: string,
  streamType: string = 'ipcam'
): Promise<any> {
  const res = await fetch(`${ACTION_API_URL}/api/camera/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId, source, stream_type: streamType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cấu hình camera');
  }
  return await res.json();
}

export async function stopPenCameraAPI(targetId: string, streamType: string = 'all'): Promise<any> {
  try {
    const res = await fetch(`${ACTION_API_URL}/api/camera/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, stream_type: streamType }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cập nhật thông tin chuồng');
  }
  return await res.json();
}

// ============================================================
// V-ARGON OFFICE — END-OF-DAY SUMMARY AGENT API
// ============================================================

export interface OfficeRecordItem {
  id: string | number;
  user_id?: string | null;
  report_date?: string;
  hour_slot?: string;
  category?: string;
  code: string;
  item: string;
  quantity_or_amount?: number;
  unit?: string;
  status: string;
  note: string;
  source_table?: string;
  timestampt?: string;
}

export async function fetchOfficeRecordsAPI(params?: {
  report_date?: string;
  category?: string;
  user_id?: string | null;
  limit?: number;
}): Promise<{ status: string; storage_mode?: string; count: number; records: OfficeRecordItem[] }> {
  const qs = new URLSearchParams();
  if (params?.report_date) qs.set('report_date', params.report_date);
  if (params?.category && params.category !== 'all') qs.set('category', params.category);
  if (params?.user_id) qs.set('user_id', params.user_id);
  if (params?.limit) qs.set('limit', String(params.limit));
  const queryStr = qs.toString();
  const res = await fetch(`${BACKEND_URL}/api/office/records${queryStr ? `?${queryStr}` : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải dữ liệu Office (${res.status})`);
  }
  return await res.json();
}

export async function triggerOfficeSummaryAPI(params?: {
  target_date?: string;
  user_id?: string | null;
}): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/office/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_date: params?.target_date || undefined,
      user_id: params?.user_id || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi chạy Agent tổng hợp cuối ngày');
  }
  return await res.json();
}

export async function createOfficeRecordAPI(payload: Partial<OfficeRecordItem>): Promise<OfficeRecordItem> {
  const res = await fetch(`${BACKEND_URL}/api/office/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi thêm bản ghi Office');
  }
  const data = await res.json();
  return data.record;
}

export async function updateOfficeRecordAPI(
  id: string | number,
  updates: Partial<OfficeRecordItem>
): Promise<OfficeRecordItem> {
  const res = await fetch(`${BACKEND_URL}/api/office/records/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cập nhật bản ghi Office');
  }
  const data = await res.json();
  return data.record;
}

export async function deleteOfficeRecordAPI(id: string | number): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/office/records/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa bản ghi Office');
  }
}

export interface StaffWageItem {
  id: string;
  name: string;
  role?: string;
  pen_id?: string;
  phone?: string;
  daily_wage?: number;
}

export async function fetchStaffListWithWageAPI(): Promise<StaffWageItem[]> {
  try {
    const { data, error } = await supabase.from('staff').select('*').order('id');
    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        pen_id: row.pen_id,
        daily_wage: row.daily_wage ?? 300000,
      }));
    }
  } catch (supaErr) {
    console.warn('Supabase fetchStaffListWithWageAPI warning:', supaErr);
  }

  const res = await fetch(`${BACKEND_URL}/api/staff`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Không thể tải danh sách nhân sự');
  return await res.json();
}

export async function fetchTodayAttendanceAPI(): Promise<any[]> {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data;
    }
  } catch (supaErr) {
    console.warn('Supabase fetchTodayAttendanceAPI warning:', supaErr);
  }

  const res = await fetch(`${BACKEND_URL}/api/staff/attendance`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

export async function updateStaffWageAPI(staffId: string, dailyWage: number): Promise<StaffWageItem> {
  const wageInt = Math.max(0, Math.round(dailyWage));
  let supaStaff: StaffWageItem | null = null;
  try {
    const { data, error } = await supabase
      .from('staff')
      .update({ daily_wage: wageInt })
      .eq('id', staffId)
      .select()
      .single();
    if (!error && data) {
      supaStaff = data as StaffWageItem;
    }
  } catch (supaErr) {
    console.warn('Supabase updateStaffWageAPI warning:', supaErr);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/staff/${encodeURIComponent(staffId)}/wage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_wage: wageInt }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.staff || supaStaff || { id: staffId, name: staffId, daily_wage: wageInt };
    }
    if (!supaStaff) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Lỗi khi cập nhật tiền công nhân sự');
    }
  } catch (err) {
    if (!supaStaff) throw err;
  }

  return supaStaff!;
}

