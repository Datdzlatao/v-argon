'use client';

import React, { useEffect, useRef, useState } from 'react';
import { VArgonLogo } from '../../components/VArgonLogo';
import {
  Home,
  Video,
  ScanFace,
  MessageCircle,
  Thermometer,
  Droplets,
  Wind,
  Fan,
  CloudRain,
  Flame,
  Sprout,
  Send,
  RefreshCw,
  Share,
  Sparkles,
  Power,
  CheckCircle2,
  AlertTriangle,
  Package,
  Calendar,
  Bell,
  Users,
  ImagePlus,
  X,
  Briefcase,
} from 'lucide-react';
import './ios.css';
import { supabase } from '../../lib/supabase';
import WebSocketStreamPlayer from '../../components/WebSocketStreamPlayer';
import GeminiMarkdown from '../../components/GeminiMarkdown';
import FeedExtendedModules from '../../components/FeedExtendedModules';
import {
  BACKEND_URL,
  connectAgentWebSocket,
  getActionVideoStreamWsUrl,
  getFaceVideoStreamWsUrl,
  getActionTrackerStatusAPI,
  getActionLogsAPI,
  stopPenCameraAPI,
  configurePenCameraAPI,
  startCameraDeviceAPI,
  stopCameraDeviceAPI,
  getCameraLatestTelemetryAPI,
  getStaffList,
  getStaffAttendanceHistory,
  checkInStaff,
  controlDeviceViaAPI,
  sendAgentChat,
  sendAgentChatStream,
  getChatHistory,
  triggerDailyBriefing,
  fetchNewsfeedState,
  executeNewsfeedQuickApi,
  NewsfeedItem,
  fileToBase64,
  diagnoseDiseaseWithBase64,
} from '../../lib/agent-api';

type TabKey = 'home' | 'camera' | 'attendance' | 'manage' | 'chat';

interface PenItem {
  id: string;
  name: string;
  type?: string;
  camera_url?: string;
  webcam_url?: string;
}

function formatActionLabel(telemetry: any): { title: string; reason?: string } {
  if (!telemetry) return { title: '👀 Đang giám sát khu vực' };
  const raw = String(telemetry.last_action || '').trim();
  const fsm = String(telemetry.fsm_state || 'IDLE');
  const reason = telemetry.last_action_reason ? String(telemetry.last_action_reason) : undefined;

  if (raw.toUpperCase() === 'FEEDING') return { title: '🍲 Đang thực hiện: Cho vật nuôi ăn', reason };
  if (raw.toUpperCase() === 'WATERING') return { title: '💧 Đang thực hiện: Tưới nước', reason };
  if (raw.toUpperCase() === 'FERTILIZING') return { title: '🌱 Đang thực hiện: Bón phân', reason };
  if (raw.toLowerCase() === 'ai analyzing...') return { title: '🤖 AI đang phân tích hành động...', reason };
  if (!raw || raw.toLowerCase() === 'none' || raw === 'Bình thường') {
    if (fsm === 'TRIGGERED') return { title: '⚡ Phát hiện thao tác — đang xác thực AI...', reason };
    if (fsm === 'COOLDOWN') return { title: `⏳ Vừa hoàn tất thao tác (${Math.round(telemetry.cooldown_remaining || 0)}s)`, reason };
    return { title: '👀 Đang giám sát (Chưa phát hiện hành động)', reason };
  }
  return { title: `🎬 Hành động: ${raw}`, reason };
}

export default function IosPwaPage() {
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pens, setPens] = useState<PenItem[]>([]);
  const [currentPenId, setCurrentPenId] = useState<string>('');
  const [env, setEnv] = useState<any>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [newsfeedItems, setNewsfeedItems] = useState<NewsfeedItem[]>([]);
  const [newsfeedSummary, setNewsfeedSummary] = useState<string>('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [animalsCount, setAnimalsCount] = useState<number>(0);
  const [cropsCount, setCropsCount] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Camera AI state
  const [isActionCamOn, setIsActionCamOn] = useState(false);
  const [streamMode, setStreamMode] = useState<'ipcam' | 'webcam' | 'dual'>('ipcam');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [ipCamInput, setIpCamInput] = useState('');

  // Face & Uniform state
  const [isFaceCamOn, setIsFaceCamOn] = useState(false);
  const [faceTelemetry, setFaceTelemetry] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [hasStreamChunk, setHasStreamChunk] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    contentType: string;
    dataUrl: string;
  } | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; imageUrl?: string; isStreaming?: boolean }>>([
    { sender: 'agent', text: 'Xin chào! Tôi là Trợ lý Nông Trại. Bạn có thể nhắn tin hoặc gửi ảnh cây trồng/vật nuôi để kiểm tra bệnh.' },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentPen = pens.find((p) => p.id === currentPenId) || pens[0];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 3000);
  };

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

function getOrCreateIosUserId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000001';
  try {
    const key = 'vargon_ios_user_id';
    const existing = window.localStorage.getItem(key);
    if (existing && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(existing)) {
      return existing;
    }
    const generated =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    return '00000000-0000-4000-8000-000000000001';
  }
}

  // Load initial Pens + Farm Data from real FastAPI endpoints (isolated by user_id)
  const loadFarmData = async (penIdOverride?: string) => {
    setIsLoading(true);
    try {
      const uid = getOrCreateIosUserId();
      const pensRes = await fetch(`${BACKEND_URL}/api/pens?user_id=${encodeURIComponent(uid)}`);
      let activePenId = penIdOverride || currentPenId;
      if (pensRes.ok) {
        const pensData = await pensRes.json();
        let list = Array.isArray(pensData) ? pensData : pensData?.pens || [];
        if (list.length === 0) {
          const starter = {
            id: `PEN-${uid.slice(0, 6).toUpperCase()}-L1`,
            name: 'Chuồng Cá Nhân Khu 1',
            type: 'livestock',
            user_id: uid,
          };
          const createdRes = await fetch(`${BACKEND_URL}/api/pens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(starter),
          }).catch(() => null);
          if (createdRes?.ok) {
            const createdJson = await createdRes.json();
            list = [createdJson.pen || starter];
          } else {
            list = [starter];
          }
        }
        setPens(list);
        if (!activePenId && list.length > 0) {
          activePenId = list[0].id;
          setCurrentPenId(list[0].id);
        }
      }

      const penQuery = activePenId ? `pen_id=${encodeURIComponent(activePenId)}` : '';

      const [envRes, devRes, alertRes, invRes, schedRes, animRes, cropRes, staff, attLogs] = await Promise.all([
        fetch(`${BACKEND_URL}/api/env/latest?limit=1${penQuery ? `&${penQuery}` : ''}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/devices${penQuery ? `?${penQuery}` : ''}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/alerts?limit=5`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/inventory?user_id=${encodeURIComponent(uid)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/schedules`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/animals${penQuery ? `?${penQuery}` : ''}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BACKEND_URL}/api/crops${penQuery ? `?${penQuery}` : ''}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        getStaffList().catch(() => []),
        getStaffAttendanceHistory(10).catch(() => []),
      ]);

      if (Array.isArray(envRes) && envRes.length > 0) setEnv(envRes[0]);
      if (Array.isArray(devRes)) setDevices(devRes);
      if (Array.isArray(alertRes)) setAlerts(alertRes);
      if (Array.isArray(invRes)) setInventory(invRes);
      if (Array.isArray(schedRes)) setSchedules(schedRes);
      if (Array.isArray(animRes)) setAnimalsCount(animRes.length);
      if (Array.isArray(cropRes)) setCropsCount(cropRes.length);
      setStaffList(staff);
      if (staff.length > 0 && !selectedStaffId) setSelectedStaffId(staff[0].id);
      setAttendanceHistory(attLogs);

      if (activePenId) {
        const hist = await getChatHistory(uid, activePenId);
        if (hist.length > 0) {
          setMessages(hist.map((m) => ({ sender: m.sender, text: m.content })));
        }
      }
    } catch {
      showToast('Không kết nối được tới máy chủ Backend');
    } finally {
      setIsLoading(false);
    }
  };

  const syncNewsfeed = async () => {
    const uid = getOrCreateIosUserId();
    const state = await fetchNewsfeedState(undefined, 12, uid);
    if (state) {
      setNewsfeedItems(state.items || []);
      if (state.summary_text) setNewsfeedSummary(state.summary_text);
    }
  };

  useEffect(() => {
    loadFarmData();
    syncNewsfeed();
    const timer = setInterval(syncNewsfeed, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentPenId) {
      loadFarmData(currentPenId);
      const p = pens.find((x) => x.id === currentPenId);
      setIpCamInput(p?.camera_url || '');
    }
  }, [currentPenId]);

  // Realtime Farm WebSocket (/ws)
  useEffect(() => {
    const disconnect = connectAgentWebSocket(
      (event, data) => {
        if (event === 'env_update' && data) {
          setEnv(data);
        } else if (event === 'device_update' && data) {
          setDevices((prev) =>
            prev.map((d) =>
              d.id === data.id || d.name === data.name
                ? { ...d, is_active: data.is_active ?? data.status, status: data.status ?? data.is_active }
                : d
            )
          );
        } else if (event === 'alert' && data) {
          setAlerts((prev) => [data, ...prev].slice(0, 5));
          showToast(`⚠️ Cảnh báo: ${data.message || data.alert_type}`);
          syncNewsfeed();
        } else if (event === 'newsfeed_update' && data) {
          if (Array.isArray(data.items)) setNewsfeedItems(data.items);
          if (data.summary_text) setNewsfeedSummary(data.summary_text);
        } else if (event === 'chat_message' && data) {
          if ((!data.user_id || data.user_id === 'ios_pwa_user') && data.content) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.sender === data.sender && m.text === data.content);
              return exists ? prev : [...prev, { sender: data.sender, text: data.content }];
            });
          }
        } else if (event === 'staff_checkin' && data) {
          setAttendanceHistory((prev) => [data, ...prev].slice(0, 10));
          showToast(`✅ Điểm danh: ${data.staff_name || data.staff_id}`);
        }
      },
      (status) => setWsConnected(status === 'connected')
    );
    return disconnect;
  }, []);

  // Poll Action Telemetry when Camera tab is active
  useEffect(() => {
    if (!isActionCamOn || !currentPenId) return;
    const poll = async () => {
      const type = streamMode === 'dual' ? 'ipcam' : streamMode;
      const [st, logsRes] = await Promise.all([
        getActionTrackerStatusAPI(currentPenId, type),
        getActionLogsAPI(currentPenId, 8),
      ]);
      if (st) setTelemetry(st);
      setActionLogs(logsRes?.data || []);
    };
    poll();
    const id = setInterval(poll, 900);
    return () => clearInterval(id);
  }, [isActionCamOn, currentPenId, streamMode]);

  // Poll Face & Uniform Telemetry when Face Cam is active
  useEffect(() => {
    if (!isFaceCamOn) return;
    const poll = async () => {
      const res = await getCameraLatestTelemetryAPI();
      if (res) setFaceTelemetry(res);
    };
    poll();
    const id = setInterval(poll, 700);
    return () => clearInterval(id);
  }, [isFaceCamOn]);

  const handleToggleDevice = async (device: any) => {
    const isOn = Boolean(device.is_active ?? device.status);
    const next = !isOn;
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, is_active: next, status: next } : d))
    );
    try {
      await controlDeviceViaAPI(
        currentPenId || device.pen_id || 'DEFAULT',
        device.name || device.device_type,
        next ? 'turn_on' : 'turn_off'
      );
      showToast(`${device.name}: ${next ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}`);
    } catch {
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, is_active: isOn, status: isOn } : d))
      );
      showToast('Lỗi điều khiển thiết bị');
    }
  };

  const handleToggleActionCam = () => {
    if (isActionCamOn) {
      setIsActionCamOn(false);
      if (currentPenId) stopPenCameraAPI(currentPenId, 'all').catch(() => {});
    } else {
      setIsActionCamOn(true);
    }
  };

  const handleSaveIpCam = async () => {
    if (!currentPenId || !ipCamInput.trim()) return;
    try {
      await configurePenCameraAPI(currentPenId, ipCamInput.trim(), 'ipcam');
      setPens((prev) =>
        prev.map((p) => (p.id === currentPenId ? { ...p, camera_url: ipCamInput.trim() } : p))
      );
      showToast('Đã cập nhật IP Camera');
    } catch {
      showToast('Lỗi cấu hình camera');
    }
  };

  const handleToggleFaceCam = async () => {
    if (isFaceCamOn) {
      setIsFaceCamOn(false);
      await stopCameraDeviceAPI().catch(() => {});
    } else {
      setIsFaceCamOn(true);
      await startCameraDeviceAPI('0', -1).catch(() => {});
    }
  };

  const handleManualCheckIn = async (type: 'check_in' | 'check_out') => {
    if (!selectedStaffId) return;
    const staffObj = staffList.find((s) => s.id === selectedStaffId);
    try {
      await checkInStaff({
        staffId: selectedStaffId,
        staffName: staffObj?.full_name,
        checkType: type,
        penId: currentPenId || '123',
        note: 'Điểm danh từ iOS PWA',
      });
      const logs = await getStaffAttendanceHistory(10);
      setAttendanceHistory(logs);
      showToast(type === 'check_in' ? '✅ Đã chấm công vào ca' : '🔴 Đã chấm công tan ca');
    } catch (e: any) {
      showToast(e?.message || 'Lỗi chấm công');
    }
  };

  const handleTriggerBriefing = async () => {
    try {
      const res = await triggerDailyBriefing();
      showToast('☀️ Đã tạo bản tin trang trại');
      if (res?.briefing) {
        setActiveTab('chat');
        setMessages((prev) => [...prev, { sender: 'agent', text: res.briefing }]);
      }
    } catch {
      showToast('Lỗi tạo bản tin');
    }
  };

  const handleChatImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const encoded = await fileToBase64(file);
      setSelectedImage(encoded);
    } catch {
      showToast('Không đọc được file ảnh đã chọn');
    }
  };

  const handleChatPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const encoded = await fileToBase64(file);
            setSelectedImage(encoded);
          } catch {
            showToast('Không đọc được ảnh từ clipboard');
          }
          break;
        }
      }
    }
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    const imageToSend = selectedImage;
    if ((!text && !imageToSend) || isSendingChat) return;
    setChatInput('');
    setSelectedImage(null);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: text || '📷 Gửi ảnh kiểm tra bệnh',
        imageUrl: imageToSend?.dataUrl,
      },
    ]);
    setIsSendingChat(true);
    setHasStreamChunk(false);

    const animateReveal = async (fullText: string) => {
      setHasStreamChunk(true);
      let msgIdx = -1;
      setMessages((prev) => {
        msgIdx = prev.length;
        return [...prev, { sender: 'agent', text: '', isStreaming: true }];
      });
      const tokens = fullText.split(/(\s+)/);
      let acc = '';
      const step = Math.max(1, Math.ceil(tokens.length / 45));
      for (let i = 0; i < tokens.length; i += step) {
        acc += tokens.slice(i, i + step).join('');
        setMessages((prev) => prev.map((m, idx) => (idx === msgIdx ? { ...m, text: acc } : m)));
        await new Promise((r) => setTimeout(r, 18));
      }
      setMessages((prev) =>
        prev.map((m, idx) => (idx === msgIdx ? { ...m, text: fullText, isStreaming: false } : m))
      );
    };

    try {
      if (imageToSend) {
        const diag = await diagnoseDiseaseWithBase64(
          imageToSend.base64,
          text || 'Phân tích và chẩn đoán hình ảnh nông nghiệp này giúp tôi',
          imageToSend.contentType,
          currentPenId || undefined,
          'ios_pwa_user'
        );
        const replyText = [
          diag.disease_name ? `🩺 Chẩn đoán: ${diag.disease_name}` : null,
          diag.species ? `🌿/🐖 Đối tượng: ${diag.species} (${diag.category === 'crop' ? 'Cây trồng' : 'Vật nuôi'})` : null,
          diag.text ? `🔍 Mô tả: ${diag.text}` : null,
          `\n📋 Hướng dẫn xử lý:\n${diag.answer}`,
          diag.sources?.length ? `\n📚 Nguồn: ${diag.sources.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('\n');
        await animateReveal(replyText);
      } else {
        let accumulated = '';
        let msgIdx = -1;
        await sendAgentChatStream(text, currentPenId || undefined, 'ios_pwa_user', {
          onChunk: (delta) => {
            accumulated += delta;
            if (msgIdx === -1) {
              setHasStreamChunk(true);
              setMessages((prev) => {
                msgIdx = prev.length;
                return [...prev, { sender: 'agent', text: accumulated, isStreaming: true }];
              });
            } else {
              setMessages((prev) =>
                prev.map((m, idx) => (idx === msgIdx ? { ...m, text: accumulated } : m))
              );
            }
          },
          onDone: (fullReply) => {
            const finalText = fullReply || accumulated || 'Đã xử lý.';
            if (msgIdx === -1) {
              setHasStreamChunk(true);
              setMessages((prev) => [...prev, { sender: 'agent', text: finalText, isStreaming: false }]);
            } else {
              setMessages((prev) =>
                prev.map((m, idx) => (idx === msgIdx ? { ...m, text: finalText, isStreaming: false } : m))
              );
            }
          },
        });
      }
    } catch {
      setMessages((prev) => [...prev, { sender: 'agent', text: 'Không kết nối được tới máy chủ trợ lý.' }]);
    } finally {
      setIsSendingChat(false);
      setHasStreamChunk(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const getDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('quạt') || lower.includes('fan')) return { icon: Fan, color: 'text-sky-600 bg-sky-50' };
    if (lower.includes('sương') || lower.includes('mist')) return { icon: CloudRain, color: 'text-cyan-600 bg-cyan-50' };
    if (lower.includes('sưởi') || lower.includes('đèn') || lower.includes('heat')) return { icon: Flame, color: 'text-orange-600 bg-orange-50' };
    return { icon: Sprout, color: 'text-emerald-600 bg-emerald-50' };
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSession(s);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleIosAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr('');
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
        if (error) setAuthErr(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email: loginEmail.trim(), password: loginPassword });
        if (error) setAuthErr(error.message);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const actionStatus = formatActionLabel(telemetry);
  const ipWsUrl = getActionVideoStreamWsUrl(currentPenId || 'DEFAULT', 'ipcam', currentPen?.camera_url);
  const webcamWsUrl = getActionVideoStreamWsUrl(currentPenId || 'DEFAULT', 'webcam', currentPen?.webcam_url || '0');

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] text-slate-500 text-sm">
        Đang khởi động V-ARGON...
      </div>
    );
  }

  if (!session && !isDemoMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F7] px-5 py-8">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-black/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#15803D] flex items-center justify-center shrink-0">
              <VArgonLogo className="w-6 h-6" variant="white" />
            </div>
            <div>
              <h1 className="text-[18px] font-extrabold text-slate-900">V-ARGON FarmOS</h1>
              <p className="text-[12px] text-emerald-700 font-semibold">Đăng nhập hệ thống quản lý</p>
            </div>
          </div>

          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-[12px] font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthErr(''); }}
              className={`py-1.5 rounded-lg ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthErr(''); }}
              className={`py-1.5 rounded-lg ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleIosAuth} className="space-y-2.5">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Email..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-[13px] outline-none"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Mật khẩu..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-[13px] outline-none"
            />
            {authErr && <p className="text-[12px] text-rose-600 font-medium">{authErr}</p>}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold disabled:opacity-50"
            >
              {authBusy ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setIsDemoMode(true)}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-bold"
          >
            Dùng thử nhanh (Demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      {toast && (
        <div className="fixed top-14 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md text-white text-[13px] font-semibold px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 ios-glass ios-safe-top border-b border-black/10">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#15803D] flex items-center justify-center shrink-0 shadow-sm">
              <VArgonLogo className="w-4 h-4" variant="white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                V-ARGON iOS
              </p>
              <h1 className="text-[20px] font-bold tracking-tight leading-tight">
                {activeTab === 'home' && 'Tổng quan trang trại'}
                {activeTab === 'camera' && 'Camera AI Giám sát'}
                {activeTab === 'attendance' && 'Quét mặt & Bảo hộ'}
                {activeTab === 'manage' && 'Quản lý chung'}
                {activeTab === 'chat' && 'Trợ lý V-ARGON AI'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                wsConnected ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {wsConnected ? 'Trực tiếp' : 'Kết nối...'}
            </span>
            <button
              onClick={() => loadFarmData(currentPenId || undefined)}
              className="w-8 h-8 rounded-full bg-black/5 active:bg-black/10 flex items-center justify-center"
              aria-label="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 text-slate-700 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {pens.length > 0 && (
          <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto no-scrollbar">
            {pens.map((pen) => {
              const selected = pen.id === currentPenId;
              return (
                <button
                  key={pen.id}
                  onClick={() => setCurrentPenId(pen.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition ${
                    selected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-black/[0.06] text-slate-700 active:bg-black/10'
                  }`}
                >
                  {pen.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 overflow-x-hidden px-4 pt-3 pb-28 space-y-4 max-w-2xl w-full mx-auto">
        {!isStandalone && (
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Share className="w-5 h-5" />
            </div>
            <div className="text-[12px] leading-snug text-slate-600">
              <strong className="text-slate-900 block">Cài đặt như App iPhone:</strong>
              Bấm nút <strong>Chia sẻ</strong> ở thanh dưới Safari → chọn{' '}
              <strong>Thêm vào màn hình chính</strong>.
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <>
            {(newsfeedSummary || newsfeedItems.length > 0) && (
              <section>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                    Bản tin & Quan sát trực tiếp
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ĐANG ĐỒNG BỘ
                  </span>
                </div>
                {newsfeedSummary && (
                  <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-200 text-[13px] text-slate-800 mb-2 max-h-40 overflow-y-auto break-words">
                    <GeminiMarkdown text={newsfeedSummary} />
                  </div>
                )}
                {newsfeedItems.slice(0, 3).map((item) => {
                  const isCrit = item.severity === 'critical';
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-3 shadow-sm border mb-2 ${
                        isCrit ? 'bg-rose-50 border-rose-200' : 'bg-white border-black/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-900">{item.title}</p>
                          <div className="text-[12px] text-slate-600 mt-0.5">
                            <GeminiMarkdown text={item.summary || ''} />
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (item.pen_id && item.pen_id !== currentPenId) {
                              setCurrentPenId(item.pen_id);
                            }
                            if (item.quick_api) {
                              await executeNewsfeedQuickApi(item.quick_api.endpoint, item.quick_api.body).catch(() => {});
                              syncNewsfeed();
                              showToast(`Đã xử lý tại ${item.title}`);
                            } else if (item.action_route === 'camera') {
                              setActiveTab('camera');
                            } else if (item.action_route === 'devices' || item.action_route === 'env') {
                              setActiveTab('home');
                              showToast(`Đang xem khu vực ${item.title}`);
                            } else {
                              setActiveTab('chat');
                              if (item.target_id) {
                                setChatInput(`Kiểm tra chi tiết ${item.target_id} tại ${item.title}`);
                              }
                            }
                          }}
                          className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white ${
                            item.is_resolved ? 'bg-emerald-600' : isCrit ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                        >
                          {item.action_label}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {alerts.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Bell className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-[13px] text-rose-900">
                  <strong className="block">{alerts[0].alert_type || 'Cảnh báo hệ thống'}</strong>
                  <span>{alerts[0].message}</span>
                </div>
              </div>
            )}

            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  Môi trường & Quy mô
                </h2>
                <button
                  onClick={handleTriggerBriefing}
                  className="text-[12px] font-semibold text-emerald-600"
                >
                  ☀️ Bản tin AI
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-rose-500 mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-500">Nhiệt độ</span>
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <div className="text-[24px] font-bold tracking-tight">
                    {env.temperature ?? '--'}°C
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-sky-500 mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-500">Độ ẩm</span>
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div className="text-[24px] font-bold tracking-tight">
                    {env.humidity ?? '--'}%
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-amber-500 mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-500">Mức mùi / NH₃</span>
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="text-[24px] font-bold tracking-tight">
                    {env.smell_level ?? env.nh3 ?? '--'}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-emerald-600 mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-500">Vật nuôi / Cây</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-[20px] font-bold tracking-tight">
                    {animalsCount} con • {cropsCount} cây
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 px-1 mb-2">
                Điều khiển thiết bị ({devices.length})
              </h2>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-black/[0.06] overflow-hidden">
                {devices.length === 0 ? (
                  <p className="p-4 text-[13px] text-slate-500 text-center">
                    Chưa có thiết bị IoT trong khu vực này
                  </p>
                ) : (
                  devices.map((dev) => {
                    const style = getDeviceIcon(dev.name || '');
                    const Icon = style.icon;
                    const on = Boolean(dev.is_active ?? dev.status);
                    return (
                      <div key={dev.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${style.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[15px] font-medium block">{dev.name}</span>
                            <span className="text-[11px] text-slate-400">{on ? 'Đang bật' : 'Đang tắt'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleDevice(dev)}
                          className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors ${
                            on ? 'bg-emerald-500' : 'bg-[#E9E9EA]'
                          }`}
                          aria-label={dev.name}
                        >
                          <span
                            className={`block w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
                              on ? 'translate-x-[20px]' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-[12px] font-semibold mb-1">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>Kho vật tư</span>
                </div>
                <p className="text-[20px] font-bold">{inventory.length} mặt hàng</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-[12px] font-semibold mb-1">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Lịch chăm sóc</span>
                </div>
                <p className="text-[20px] font-bold">{schedules.length} lịch</p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="bg-black/[0.06] p-1 rounded-xl grid grid-cols-3 gap-1">
              {[
                { id: 'ipcam', label: '📱 IP Cam' },
                { id: 'webcam', label: '💻 Webcam' },
                { id: 'dual', label: '👥 2 Luồng' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setStreamMode(m.id as any)}
                  className={`py-1.5 rounded-lg text-[13px] font-semibold transition ${
                    streamMode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {isActionCamOn ? (
              <div className="space-y-2.5">
                {streamMode === 'dual' ? (
                  <>
                    <div className="rounded-2xl overflow-hidden">
                      <WebSocketStreamPlayer wsUrl={ipWsUrl} altText="IP Cam" isActive={isActionCamOn} label="IP Cam" />
                    </div>
                    <div className="rounded-2xl overflow-hidden">
                      <WebSocketStreamPlayer wsUrl={webcamWsUrl} altText="Webcam" isActive={isActionCamOn} label="Webcam" />
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl overflow-hidden">
                    <WebSocketStreamPlayer
                      wsUrl={streamMode === 'webcam' ? webcamWsUrl : ipWsUrl}
                      altText="Camera AI"
                      isActive={isActionCamOn}
                      label={streamMode === 'webcam' ? 'Webcam Máy Tính' : 'IP Cam Điện Thoại'}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black rounded-2xl aspect-video flex flex-col items-center justify-center text-white p-6 text-center">
                <Video className="w-10 h-10 text-white/40 mb-2" />
                <p className="text-[15px] font-semibold">Camera đang tắt</p>
                <p className="text-[12px] text-white/60 mt-1">Bật camera để xem trực tiếp qua WebSocket</p>
              </div>
            )}

            <div className="bg-white rounded-2xl p-3.5 shadow-sm flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-emerald-700">{actionStatus.title}</p>
                {actionStatus.reason && (
                  <p className="text-[12px] text-slate-600 mt-0.5">{actionStatus.reason}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleToggleActionCam}
              className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition ${
                isActionCamOn ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              {isActionCamOn ? 'Tắt Camera Giám Sát' : 'Bật Camera Giám Sát'}
            </button>

            <div className="bg-white rounded-2xl p-3.5 shadow-sm flex gap-2">
              <input
                value={ipCamInput}
                onChange={(e) => setIpCamInput(e.target.value)}
                placeholder="URL IP Cam (VD: http://192.168.1.x:8080/video)"
                className="flex-1 text-[13px] bg-slate-100 rounded-xl px-3 py-2 outline-none"
              />
              <button
                onClick={handleSaveIpCam}
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-semibold"
              >
                Lưu
              </button>
            </div>

            {actionLogs.length > 0 && (
              <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2">
                <h3 className="text-[13px] font-semibold text-slate-500 uppercase">Nhật ký hành động</h3>
                {actionLogs.map((log, idx) => (
                  <div key={idx} className="text-[13px] py-1.5 border-t border-black/5 flex justify-between gap-2">
                    <span className="font-semibold text-slate-800">{log.action_type || log.action || 'Hành động'}</span>
                    <span className="text-slate-400 text-[11px] truncate">{log.confidence_note || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-900 uppercase">Danh sách nhân sự ({staffList.length})</h3>
                <span className="text-[11px] font-semibold text-emerald-700">ID tự tăng</span>
              </div>
              {staffList.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2">Chưa có danh sách nhân sự.</p>
              ) : (
                staffList.map((s) => (
                  <div key={s.id} className="py-2 border-t border-black/5 flex items-center justify-between text-[13px]">
                    <span className="font-bold text-slate-900">{s.full_name || s.name || s.id}</span>
                    <span className="text-[11px] text-slate-500">ID: {s.id} • {s.role || 'Nhân viên'}</span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2">
              <h3 className="text-[13px] font-semibold text-slate-500 uppercase">Lịch sử ra vào ({attendanceHistory.length})</h3>
              {attendanceHistory.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2">Chưa có lịch sử ra vào.</p>
              ) : (
                attendanceHistory.map((rec, i) => (
                  <div key={i} className="text-[13px] py-1.5 border-t border-black/5 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold block truncate">{rec.staff_name || rec.staff_id}</span>
                      <span className="text-[11px] text-slate-400">
                        {rec.created_at ? new Date(rec.created_at).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[12px] shrink-0">
                      {rec.check_type === 'check_in' ? '🟢 Vào ca' : '🔴 Tan ca'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <FeedExtendedModules
            penName={currentPen?.name || 'Toàn Trang Trại'}
            userId={null}
          />
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col space-y-3">
            <div className="space-y-2.5">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] min-w-0 break-words overflow-hidden px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt="Ảnh kiểm chứng"
                        className="w-full max-h-48 object-cover rounded-xl mb-2"
                      />
                    )}
                    <GeminiMarkdown
                      text={m.text}
                      isUser={m.sender === 'user'}
                      isStreaming={Boolean(m.isStreaming)}
                    />
                  </div>
                </div>
              ))}
              {isSendingChat && !hasStreamChunk && (
                <div className="flex justify-start">
                  <div className="w-[78%] bg-white rounded-2xl rounded-bl-sm px-3.5 py-3 shadow-sm space-y-2 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Trợ lý đang suy nghĩ...</span>
                    </div>
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-200 via-teal-100 to-emerald-200 w-11/12" />
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-100 via-teal-200 to-emerald-100 w-3/4" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {selectedImage && (
              <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={selectedImage.dataUrl}
                    alt="Xem trước"
                    className="w-11 h-11 rounded-xl object-cover border border-emerald-300 shrink-0"
                  />
                  <span className="text-[12px] text-emerald-800 font-medium truncate">
                    Ảnh đã sẵn sàng gửi kiểm tra bệnh
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="w-7 h-7 rounded-full bg-white text-slate-500 flex items-center justify-center border border-black/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 bg-white rounded-full p-1.5 pl-2 shadow-sm border border-black/5">
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleChatImagePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={isSendingChat}
                className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 disabled:opacity-40"
                title="Chọn hoặc chụp ảnh để kiểm tra bệnh"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                onPaste={handleChatPaste}
                placeholder={selectedImage ? 'Mô tả thêm triệu chứng...' : 'Nhắn tin hoặc dán ảnh vào đây...'}
                className="flex-1 bg-transparent text-[15px] outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={isSendingChat || (!chatInput.trim() && !selectedImage)}
                className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 ios-glass ios-safe-bottom border-t border-black/10">
        <div className="max-w-2xl mx-auto grid grid-cols-5 h-[56px]">
          {[
            { key: 'home', label: 'Tổng quan', icon: Home },
            { key: 'camera', label: 'Camera', icon: Video },
            { key: 'attendance', label: 'Điểm danh', icon: ScanFace },
            { key: 'manage', label: 'Quản lý', icon: Briefcase },
            { key: 'chat', label: 'Trợ lý AI', icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex flex-col items-center justify-center gap-0.5 transition whitespace-nowrap ${
                  active ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-semibold whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
