'use client';

import React, { useEffect, useRef, useState } from 'react';
import { VArgonLogo } from '../components/VArgonLogo';
import {
  Home,
  Video,
  ScanFace,
  MessageCircle,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Send,
  RefreshCw,
  Share,
  Sparkles,
  Power,
  CheckCircle2,
  AlertTriangle,
  ImagePlus,
  X,
  Briefcase,
  Bell,
  BellOff,
  LogOut,
  Plus,
  Trash2,
  Settings,
  Cpu,
  QrCode,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import WebSocketStreamPlayer from '../components/WebSocketStreamPlayer';
import GeminiMarkdown from '../components/GeminiMarkdown';
import IosManageModules from '../components/IosManageModules';
import QrScannerModal, { ParsedCropQr } from '../components/QrScannerModal';
import IosAuthScreen from '../components/IosAuthScreen';
import IosEnvChart from '../components/IosEnvChart';
import IosAttendanceTab from '../components/IosAttendanceTab';
import {
  WS_URL,
  BACKEND_URL,
  PenItem,
  fetchDashboardState,
  controlDevice,
  updatePenMetadataAPI,
  getActionVideoWsUrl,
  getActionTrackerStatus,
  getActionLogs,
  stopActionCamera,
  startFaceCamera,
  stopFaceCamera,
  getFaceCameraLatest,
  sendAgentChatStream,
  getChatHistory,
  fetchNewsfeedState,
  executeNewsfeedQuickApi,
  triggerDailyBriefing,
  NewsfeedItem,
  fileToBase64,
  diagnoseDiseaseWithBase64,
} from '../lib/api';

type TabKey = 'home' | 'camera' | 'attendance' | 'manage' | 'chat';

const DEMO_USER_STORAGE_KEY = 'vargon_ios_user_id';

function getOrCreatePwaUserId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000002';
  try {
    const existing = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
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
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, generated);
    return generated;
  } catch {
    return '00000000-0000-4000-8000-000000000002';
  }
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
  // Auth & Mode
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUserId, setDemoUserId] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const activeUserId: string | null = session?.user?.id || (isDemoMode ? demoUserId || getOrCreatePwaUserId() : null);

  const [currentMode, setCurrentMode] = useState<'livestock' | 'cultivation'>('livestock');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pens, setPens] = useState<PenItem[]>([]);
  const [currentPenId, setCurrentPenId] = useState<string>('');
  const [env, setEnv] = useState<any>({});
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [newsfeedItems, setNewsfeedItems] = useState<NewsfeedItem[]>([]);
  const [newsfeedSummary, setNewsfeedSummary] = useState<string>('');
  const [wsConnected, setWsConnected] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  // Alerts & Sound
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Modals: Add Pen, Add Device, Config Camera
  const [showAddPen, setShowAddPen] = useState(false);
  const [newPenName, setNewPenName] = useState('');
  const [newPenType, setNewPenType] = useState<'livestock' | 'cultivation'>('livestock');
  const [newPenCam, setNewPenCam] = useState('');
  const [newPenWebcam, setNewPenWebcam] = useState('0');

  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevPin, setNewDevPin] = useState('12');

  const [showConfigCam, setShowConfigCam] = useState(false);
  const [editCamUrl, setEditCamUrl] = useState('');
  const [editWebcamUrl, setEditWebcamUrl] = useState('0');

  // Camera AI state
  const [isActionCamOn, setIsActionCamOn] = useState(false);
  const [streamMode, setStreamMode] = useState<'ipcam' | 'webcam' | 'dual'>('ipcam');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [actionLogs, setActionLogs] = useState<any[]>([]);

  // Face & Uniform state
  const [isFaceCamOn, setIsFaceCamOn] = useState(false);
  const [faceTelemetry, setFaceTelemetry] = useState<any>(null);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 3500);
  };

  // Detect iOS standalone PWA mode & check Supabase session
  useEffect(() => {
    alarmSoundRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
      } else if (window.sessionStorage.getItem('vargon_ios_demo') === '1') {
        setDemoUserId(getOrCreatePwaUserId());
        setIsDemoMode(true);
      }
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
      if (s) {
        setIsDemoMode(false);
        window.localStorage.removeItem('vargon_ios_demo');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const currentPen = pens.find((p) => p.id === currentPenId) || pens[0];

  // Compute environment issues for Pinned Alert Banner
  const envTemp = Number(env.temperature ?? env.temp ?? 0);
  const envNh3 = Number(env.nh3 ?? env.ammonia ?? env.smell ?? 0);
  const envIssues: string[] = [];
  if (envTemp > 33) envIssues.push(`Nhiệt độ cao bất thường (${envTemp}°C)`);
  if (envNh3 > 300) envIssues.push(`Nồng độ khí NH₃ vượt ngưỡng (${envNh3} ppm)`);

  useEffect(() => {
    if (envIssues.length > 0 && !isMuted && !dismissedAlert) {
      alarmSoundRef.current?.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envTemp, envNh3, isMuted]);

  const loadPensAndData = async (mode: 'livestock' | 'cultivation' = currentMode, preferredPenId?: string) => {
    if (!activeUserId) return;
    try {
      let query = supabase.from('pens').select('*').eq('type', mode).order('created_at', { ascending: true });
      if (activeUserId) query = query.eq('user_id', activeUserId);
      const { data: supaPens } = await query;

      let loadedPens: PenItem[] = (supaPens || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        camera_url: p.camera_url,
        webcam_url: p.webcam_url,
      }));

      if (loadedPens.length === 0) {
        const dash = await fetchDashboardState(preferredPenId, activeUserId).catch(() => null);
        if (dash?.pens?.length) {
          loadedPens = dash.pens.filter((p: any) => (p.type || 'livestock') === mode);
        }
      }

      setPens(loadedPens);
      const nextPenId =
        preferredPenId && loadedPens.some((p) => p.id === preferredPenId)
          ? preferredPenId
          : loadedPens[0]?.id || '';
      setCurrentPenId(nextPenId);
      if (nextPenId) {
        await loadPenDetails(nextPenId);
      } else {
        setDevices([]);
        setEnv({});
        setHistoryLogs([]);
      }
    } catch {}
  };

  const loadPenDetails = async (penId: string) => {
    if (!penId) return;
    try {
      const [devRes, envRes, dash] = await Promise.all([
        supabase.from('devices').select('*').eq('pen_id', penId).order('id'),
        supabase.from('env_logs').select('*').eq('pen_id', penId).order('created_at', { ascending: false }).limit(16),
        fetchDashboardState(penId, activeUserId || undefined).catch(() => null),
      ]);

      if (devRes.data && devRes.data.length > 0) {
        setDevices(devRes.data);
      } else if (Array.isArray(dash?.devices)) {
        setDevices(dash.devices);
      } else {
        setDevices([]);
      }

      if (envRes.data && envRes.data.length > 0) {
        const sorted = [...envRes.data].reverse();
        setHistoryLogs(sorted);
        const latest = sorted[sorted.length - 1];
        setEnv({
          temperature: latest.temp ?? latest.temperature,
          humidity: latest.hum ?? latest.humidity,
          nh3: latest.smell ?? latest.nh3,
          light: latest.light ?? dash?.environment?.light,
        });
      } else if (dash?.environment) {
        setEnv(dash.environment);
      }
    } catch {}
  };

  useEffect(() => {
    if (!activeUserId) return;
    loadPensAndData(currentMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId, currentMode]);

  useEffect(() => {
    if (!activeUserId || !currentPenId) return;
    loadPenDetails(currentPenId);
    getChatHistory(activeUserId, currentPenId).then((hist) => {
      if (hist && hist.length > 0) {
        setMessages(hist.map((m: any) => ({ sender: m.sender, text: m.content })));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPenId]);

  const syncNewsfeed = async () => {
    if (!activeUserId) return;
    const state = await fetchNewsfeedState(12, activeUserId);
    if (state) {
      setNewsfeedItems(state.items || []);
      if (state.summary_text) setNewsfeedSummary(state.summary_text);
    }
  };

  useEffect(() => {
    if (!activeUserId) return;
    syncNewsfeed();
    const timer = setInterval(syncNewsfeed, 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  // Realtime Farm WebSocket
  useEffect(() => {
    if (!activeUserId) return;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (e) => {
          try {
            const pkt = JSON.parse(e.data);
            if (pkt.event === 'environment_update' && pkt.data) {
              setEnv(pkt.data);
            } else if (pkt.event === 'device_update' && pkt.data) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === pkt.data.id || d.name === pkt.data.device_type
                    ? { ...d, is_active: Boolean(pkt.data.status) }
                    : d
                )
              );
              syncNewsfeed();
            } else if (pkt.event === 'newsfeed_update' && pkt.data?.items) {
              setNewsfeedItems(pkt.data.items);
              if (pkt.data.summary_text) setNewsfeedSummary(pkt.data.summary_text);
            } else if (pkt.event === 'alert') {
              syncNewsfeed();
              if (!isMuted) alarmSoundRef.current?.play().catch(() => {});
            }
          } catch {}
        };
        ws.onclose = () => {
          setWsConnected(false);
          if (!closed) timer = setTimeout(connect, 2500);
        };
        ws.onerror = () => ws?.close();
      } catch {}
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  // Poll Action Telemetry
  useEffect(() => {
    if (!isActionCamOn || !currentPenId) return;
    const poll = async () => {
      const type = streamMode === 'dual' ? 'ipcam' : streamMode;
      const [st, logs] = await Promise.all([
        getActionTrackerStatus(currentPenId, type),
        getActionLogs(currentPenId, 5),
      ]);
      if (st) setTelemetry(st);
      setActionLogs(logs);
    };
    poll();
    const id = setInterval(poll, 900);
    return () => clearInterval(id);
  }, [isActionCamOn, currentPenId, streamMode]);

  // Poll Face & Uniform Telemetry
  useEffect(() => {
    if (!isFaceCamOn) return;
    const poll = async () => {
      const res = await getFaceCameraLatest();
      if (res) setFaceTelemetry(res);
    };
    poll();
    const id = setInterval(poll, 700);
    return () => clearInterval(id);
  }, [isFaceCamOn]);

  const handleToggleDevice = async (dev: any) => {
    const next = !Boolean(dev.is_active);
    setDevices((prev) => prev.map((d) => (d.id === dev.id ? { ...d, is_active: next } : d)));
    try {
      await supabase.from('devices').update({ is_active: next }).eq('id', dev.id);
      await controlDevice(dev.name || dev.device_type, next, currentPenId || undefined).catch(() => {});
      showToast(`${dev.name}: ${next ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}`);
    } catch {
      setDevices((prev) => prev.map((d) => (d.id === dev.id ? { ...d, is_active: !next } : d)));
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim() || !currentPenId) return;
    const newDev = {
      id: `DEV-${Date.now().toString().slice(-4)}`,
      name: newDevName.trim(),
      pin_number: Number(newDevPin) || 12,
      is_active: false,
      pen_id: currentPenId,
    };
    setDevices((prev) => [...prev, newDev]);
    await supabase.from('devices').insert([newDev]);
    setNewDevName('');
    setShowAddDevice(false);
    showToast(`Đã thêm thiết bị ${newDev.name}`);
  };

  const handleDeleteDevice = async (devId: string) => {
    if (!confirm('Xóa thiết bị IoT này?')) return;
    setDevices((prev) => prev.filter((d) => d.id !== devId));
    await supabase.from('devices').delete().eq('id', devId);
    showToast('Đã xóa thiết bị');
  };

  const handleCreatePen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPenName.trim() || !activeUserId) return;
    const id = `${newPenType === 'cultivation' ? 'PEN-B' : 'PEN-A'}-${Date.now().toString().slice(-3)}`;
    const payload = {
      id,
      name: newPenName.trim(),
      type: newPenType,
      camera_url: newPenCam.trim() || null,
      webcam_url: newPenWebcam.trim() || '0',
      user_id: activeUserId,
    };
    await supabase.from('pens').insert([payload]);
    await fetch(`${BACKEND_URL}/api/pens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    setShowAddPen(false);
    setNewPenName('');
    setNewPenCam('');
    setCurrentMode(newPenType);
    await loadPensAndData(newPenType, id);
    showToast(`Đã tạo khu vực ${payload.name}`);
  };

  const handleSaveCameraConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPenId) return;
    await updatePenMetadataAPI(currentPenId, {
      camera_url: editCamUrl.trim(),
      webcam_url: editWebcamUrl.trim() || '0',
    }).catch(() => {});
    await supabase
      .from('pens')
      .update({ camera_url: editCamUrl.trim(), webcam_url: editWebcamUrl.trim() || '0' })
      .eq('id', currentPenId);
    setPens((prev) =>
      prev.map((p) =>
        p.id === currentPenId
          ? { ...p, camera_url: editCamUrl.trim(), webcam_url: editWebcamUrl.trim() || '0' }
          : p
      )
    );
    setShowConfigCam(false);
    showToast('Đã lưu cấu hình 2 luồng camera');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem('vargon_ios_demo');
    setSession(null);
    setIsDemoMode(false);
    setPens([]);
    setCurrentPenId('');
    setDevices([]);
  };

  const handleToggleActionCam = () => {
    if (isActionCamOn) {
      setIsActionCamOn(false);
      if (currentPenId) stopActionCamera(currentPenId);
    } else {
      setIsActionCamOn(true);
    }
  };

  const handleToggleFaceCam = async () => {
    if (isFaceCamOn) {
      setIsFaceCamOn(false);
      await stopFaceCamera();
    } else {
      setIsFaceCamOn(true);
      await startFaceCamera('0').catch(() => {});
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
      setMessages((prev) => [...prev, { sender: 'agent', text: 'Không đọc được file ảnh đã chọn.' }]);
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
          } catch {}
          break;
        }
      }
    }
  };

  const handleSendChat = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    const imageToSend = selectedImage;
    if ((!text && !imageToSend) || isSendingChat) return;
    if (!overrideText) setChatInput('');
    setSelectedImage(null);
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: text || '📷 Gửi ảnh kiểm tra bệnh', imageUrl: imageToSend?.dataUrl },
    ]);
    setIsSendingChat(true);
    setHasStreamChunk(false);

    try {
      if (imageToSend) {
        const diag = await diagnoseDiseaseWithBase64(
          imageToSend.base64,
          text || 'Phân tích và chẩn đoán hình ảnh nông nghiệp này giúp tôi',
          imageToSend.contentType,
          currentPenId || undefined,
          activeUserId || 'ios_pwa_user'
        );
        const replyText = [
          diag.disease_name ? `🩺 Chẩn đoán: ${diag.disease_name}` : null,
          diag.species ? `🌿/🐖 Đối tượng: ${diag.species}` : null,
          diag.text ? `🔍 Mô tả: ${diag.text}` : null,
          `\n📋 Hướng dẫn xử lý:\n${diag.answer}`,
        ]
          .filter(Boolean)
          .join('\n');
        setHasStreamChunk(true);
        setMessages((prev) => [...prev, { sender: 'agent', text: replyText }]);
      } else {
        let accumulated = '';
        let msgIdx = -1;
        await sendAgentChatStream(
          text,
          currentPenId || undefined,
          {
            onChunk: (delta) => {
              accumulated += delta;
              if (msgIdx === -1) {
                setHasStreamChunk(true);
                setMessages((prev) => {
                  msgIdx = prev.length;
                  return [...prev, { sender: 'agent', text: accumulated, isStreaming: true }];
                });
              } else {
                setMessages((prev) => prev.map((m, idx) => (idx === msgIdx ? { ...m, text: accumulated } : m)));
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
          },
          activeUserId || 'ios_pwa_user'
        );
      }
    } catch {
      setMessages((prev) => [...prev, { sender: 'agent', text: 'Không kết nối được tới máy chủ trợ lý.' }]);
    } finally {
      setIsSendingChat(false);
      setHasStreamChunk(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center text-slate-500 text-sm">
        Đang khởi động V-ARGON...
      </div>
    );
  }

  if (!activeUserId) {
    return (
      <IosAuthScreen
        onAuthSuccess={(s) => setSession(s)}
        onDemo={() => {
          window.sessionStorage.setItem('vargon_ios_demo', '1');
          setDemoUserId(getOrCreatePwaUserId());
          setIsDemoMode(true);
        }}
      />
    );
  }

  const actionStatus = formatActionLabel(telemetry);
  const ipWsUrl = getActionVideoWsUrl(currentPenId || 'DEFAULT', 'ipcam', currentPen?.camera_url);
  const webcamWsUrl = getActionVideoWsUrl(currentPenId || 'DEFAULT', 'webcam', currentPen?.webcam_url || '0');

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      {/* iOS Top Glass Navigation Bar */}
      <header className="sticky top-0 z-30 ios-glass ios-safe-top border-b border-black/10">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#15803D] flex items-center justify-center shrink-0 shadow-sm">
              <VArgonLogo className="w-4 h-4" variant="white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 truncate">
                {session?.user?.email || 'Chế độ Demo'}
              </p>
              <h1 className="text-[17px] font-bold tracking-tight leading-tight truncate">
                {activeTab === 'home' && 'Tổng quan trang trại'}
                {activeTab === 'camera' && 'Camera AI Giám sát'}
                {activeTab === 'attendance' && 'Điểm danh & Bảo hộ'}
                {activeTab === 'manage' && 'Quản lý trang trại'}
                {activeTab === 'chat' && 'Trợ lý V-ARGON AI'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                wsConnected ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {wsConnected ? 'Live' : '...'}
            </span>
            <button
              onClick={() => setShowQrScanner(true)}
              className="px-2.5 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1"
              title="Quét mã QR cây trồng"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Quét QR</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
              title={isMuted ? 'Bật chuông cảnh báo' : 'Tắt chuông cảnh báo'}
            >
              {isMuted ? <BellOff className="w-4 h-4 text-slate-500" /> : <Bell className="w-4 h-4 text-emerald-700" />}
            </button>
            <button
              onClick={() => loadPensAndData(currentMode, currentPenId)}
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4 text-slate-700" />
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher: Chăn Nuôi / Trồng Trọt */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="bg-black/[0.06] p-0.5 rounded-xl grid grid-cols-2 gap-0.5 flex-1">
            <button
              onClick={() => setCurrentMode('livestock')}
              className={`py-1 rounded-lg text-[12px] font-bold transition ${
                currentMode === 'livestock' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              🐖 Chăn Nuôi
            </button>
            <button
              onClick={() => setCurrentMode('cultivation')}
              className={`py-1 rounded-lg text-[12px] font-bold transition ${
                currentMode === 'cultivation' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              🌱 Trồng Trọt
            </button>
          </div>
        </div>

        {/* Pen Selector Pills */}
        <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto no-scrollbar items-center">
          {pens.map((pen) => {
            const selected = pen.id === currentPenId;
            return (
              <button
                key={pen.id}
                onClick={() => setCurrentPenId(pen.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition ${
                  selected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-black/[0.06] text-slate-700'
                }`}
              >
                {pen.name}
              </button>
            );
          })}
          <button
            onClick={() => {
              setNewPenType(currentMode);
              setShowAddPen(true);
            }}
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            + Thêm khu
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 pt-3 pb-28 space-y-4 max-w-2xl w-full mx-auto">
        {!isStandalone && (
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Share className="w-5 h-5" />
            </div>
            <div className="text-[12px] leading-snug text-slate-600">
              <strong className="text-slate-900 block">Cài đặt như App:</strong>
              Chọn <strong>Chia sẻ</strong> → <strong>Thêm vào màn hình chính</strong> để dùng toàn màn hình.
            </div>
          </div>
        )}

        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <>
            {/* Pinned Emergency Alert Banner */}
            {!dismissedAlert && envIssues.length > 0 && (
              <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-[13px]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cảnh báo khẩn tại {currentPen?.name || currentPenId}</span>
                  </div>
                  <button onClick={() => setDismissedAlert(true)} className="text-rose-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ul className="text-[12px] text-rose-800 space-y-0.5 list-disc pl-5">
                  {envIssues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const target = devices.find((d) =>
                        String(d.name).toLowerCase().includes(currentMode === 'cultivation' ? 'phun' : 'quạt')
                      );
                      if (target) handleToggleDevice({ ...target, is_active: false });
                      else showToast('Đã gửi lệnh kích hoạt làm mát!');
                    }}
                    className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-[12px] font-bold"
                  >
                    {currentMode === 'cultivation' ? 'Bật Phun Sương' : 'Bật Quạt Gió'}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendChat(`Phân tích cảnh báo môi trường tại ${currentPen?.name}: ${envIssues.join(', ')}`);
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-[12px] font-bold"
                  >
                    Hỏi AI
                  </button>
                </div>
              </div>
            )}

            {/* Live Observer News Feed + Daily Briefing */}
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  Bản tin quan sát trực tiếp
                </h2>
                <button
                  onClick={async () => {
                    const res = await triggerDailyBriefing().catch(() => null);
                    if (res?.briefing) setNewsfeedSummary(res.briefing);
                    syncNewsfeed();
                  }}
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
                >
                  ✨ Tổng hợp AI
                </button>
              </div>
              {newsfeedSummary && (
                <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-200 text-[13px] text-slate-800 mb-2 max-h-40 overflow-y-auto break-words">
                  <GeminiMarkdown text={newsfeedSummary} />
                </div>
              )}
              {newsfeedItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-3.5 shadow-sm text-[13px] text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hệ thống quan sát ổn định, chưa có cảnh báo mới.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {newsfeedItems.slice(0, 4).map((item) => {
                    const isCrit = item.severity === 'critical';
                    const isWarn = item.severity === 'warning';
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 shadow-sm border ${
                          isCrit ? 'bg-rose-50 border-rose-200' : isWarn ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-900">{item.title}</p>
                            <p className="text-[12px] text-slate-600 mt-0.5 leading-snug">{item.summary}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (item.pen_id && item.pen_id !== currentPenId) setCurrentPenId(item.pen_id);
                              if (item.quick_api) {
                                await executeNewsfeedQuickApi(item.quick_api.endpoint, item.quick_api.body).catch(() => {});
                                syncNewsfeed();
                              } else if (item.action_route === 'camera') {
                                setActiveTab('camera');
                              } else if (item.action_route === 'inventory' || item.action_route === 'livestock' || item.action_route === 'crops') {
                                setActiveTab('manage');
                              } else {
                                setActiveTab('chat');
                              }
                            }}
                            className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white ${
                              isCrit ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                          >
                            {item.action_label}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Environment Metrics + 24h Chart */}
            <section className="space-y-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 px-1">
                Môi trường {currentPen?.name || 'khu vực'}
              </h2>
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
                    <span className="text-[12px] font-semibold text-slate-500">Khí NH₃</span>
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="text-[24px] font-bold tracking-tight">
                    {env.nh3 ?? env.ammonia ?? '--'} <span className="text-[13px] font-normal text-slate-400">ppm</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-yellow-500 mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-500">Ánh sáng</span>
                    <Sun className="w-4 h-4" />
                  </div>
                  <div className="text-[24px] font-bold tracking-tight">
                    {env.light ?? '--'} <span className="text-[13px] font-normal text-slate-400">lux</span>
                  </div>
                </div>
              </div>

              <IosEnvChart
                historyLogs={historyLogs}
                onAskAI={() => {
                  setActiveTab('chat');
                  handleSendChat(`Phân tích chỉ số môi trường hiện tại tại ${currentPen?.name}: Nhiệt độ ${env.temperature ?? '--'}°C, Độ ẩm ${env.humidity ?? '--'}%, NH3 ${env.nh3 ?? '--'} ppm.`);
                }}
              />
            </section>

            {/* Dynamic IoT Devices */}
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  Thiết bị IoT ({devices.length})
                </h2>
                <button
                  onClick={() => setShowAddDevice(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm thiết bị
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-black/[0.06] overflow-hidden">
                {devices.length === 0 ? (
                  <p className="p-4 text-[13px] text-slate-400 text-center">
                    Chưa có thiết bị IoT trong khu vực này.
                  </p>
                ) : (
                  devices.map((dev) => {
                    const on = Boolean(dev.is_active);
                    return (
                      <div key={dev.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Cpu className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-slate-900 truncate">{dev.name}</p>
                            <p className="text-[11px] text-slate-400">GPIO Pin {dev.pin_number ?? dev.pin ?? '--'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleDevice(dev)}
                            className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors ${
                              on ? 'bg-emerald-500' : 'bg-[#E9E9EA]'
                            }`}
                          >
                            <span
                              className={`block w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
                                on ? 'translate-x-[20px]' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <button onClick={() => handleDeleteDevice(dev.id)} className="text-rose-400 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}

        {/* TAB 2: CAMERA AI */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/[0.06] p-1 rounded-xl grid grid-cols-3 gap-1">
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
              <button
                onClick={() => {
                  setEditCamUrl(currentPen?.camera_url || '');
                  setEditWebcamUrl(currentPen?.webcam_url || '0');
                  setShowConfigCam(true);
                }}
                className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700"
                title="Cấu hình Camera"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {isActionCamOn ? (
              <div className="space-y-2.5">
                {streamMode === 'dual' ? (
                  <>
                    <WebSocketStreamPlayer wsUrl={ipWsUrl} isActive={isActionCamOn} label="IP Cam" />
                    <WebSocketStreamPlayer wsUrl={webcamWsUrl} isActive={isActionCamOn} label="Webcam" />
                  </>
                ) : (
                  <WebSocketStreamPlayer
                    wsUrl={streamMode === 'webcam' ? webcamWsUrl : ipWsUrl}
                    isActive={isActionCamOn}
                    label={streamMode === 'webcam' ? 'Webcam Máy Tính' : 'IP Cam Điện Thoại'}
                  />
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
                {actionStatus.reason && <p className="text-[12px] text-slate-600 mt-0.5">{actionStatus.reason}</p>}
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

        {/* TAB 3: ATTENDANCE & FACE SCAN */}
        {activeTab === 'attendance' && (
          <IosAttendanceTab
            currentPenId={currentPenId}
            isFaceCamOn={isFaceCamOn}
            onToggleFaceCam={handleToggleFaceCam}
            faceTelemetry={faceTelemetry}
            onNotify={showToast}
          />
        )}

        {/* TAB 4: MANAGE */}
        {activeTab === 'manage' && (
          <IosManageModules
            penId={currentPenId}
            penName={currentPen?.name || 'Toàn Trang Trại'}
            penType={(currentPen as any)?.type || currentMode}
            pens={pens}
            onRefreshParent={() => loadPensAndData(currentMode, currentPenId)}
            onNotify={showToast}
            onQuickAccessCrop={async (cropId, penId) => {
              let targetPen = penId;
              if (!targetPen && cropId) {
                try {
                  const { data } = await supabase.from('crops').select('pen_id').eq('id', cropId).maybeSingle();
                  if (data?.pen_id) targetPen = String(data.pen_id);
                } catch {}
              }
              setCurrentMode('cultivation');
              setActiveTab('manage');
              if (targetPen) setCurrentPenId(targetPen);
              showToast(`Đã truy cập nhanh cây trồng #${cropId}`);
            }}
          />
        )}

        {/* TAB 5: AI CHAT */}
        {activeTab === 'chat' && (
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {['Tổng quan chuồng', 'Kiểm tra kho cám', 'Bật quạt làm mát'].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendChat(q)}
                    className="shrink-0 px-3 py-1 rounded-full bg-white text-[11px] font-semibold text-emerald-700 border border-emerald-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setMessages([{ sender: 'agent', text: 'Đã làm mới cuộc trò chuyện. Tôi có thể giúp gì cho bạn?' }])
                }
                className="shrink-0 text-[11px] text-slate-500 font-semibold px-2 py-1"
              >
                Làm mới
              </button>
            </div>

            <div className="space-y-2.5">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] min-w-0 break-words overflow-hidden px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="Ảnh kiểm chứng" className="w-full max-h-48 object-cover rounded-xl mb-2" />
                    )}
                    <GeminiMarkdown text={m.text} isUser={m.sender === 'user'} isStreaming={Boolean(m.isStreaming)} />
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
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {selectedImage && (
              <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={selectedImage.dataUrl} alt="Xem trước" className="w-11 h-11 rounded-xl object-cover border border-emerald-300 shrink-0" />
                  <span className="text-[12px] text-emerald-800 font-medium truncate">Ảnh đã sẵn sàng gửi kiểm tra bệnh</span>
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
              <input ref={chatFileInputRef} type="file" accept="image/*" onChange={handleChatImagePick} className="hidden" />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={isSendingChat}
                className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                onPaste={handleChatPaste}
                placeholder={selectedImage ? 'Mô tả thêm triệu chứng...' : 'Nhắn tin hoặc dán ảnh...'}
                className="flex-1 bg-transparent text-[15px] outline-none"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isSendingChat || (!chatInput.trim() && !selectedImage)}
                className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showAddPen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreatePen} className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold">Thêm Khu Vực Mới</h3>
              <button type="button" onClick={() => setShowAddPen(false)}><X className="w-4 h-4" /></button>
            </div>
            <input
              value={newPenName}
              onChange={(e) => setNewPenName(e.target.value)}
              placeholder="Tên chuồng / vườn (VD: Chuồng Heo 02)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none"
              required
            />
            <select
              value={newPenType}
              onChange={(e) => setNewPenType(e.target.value as any)}
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none"
            >
              <option value="livestock">Chăn Nuôi</option>
              <option value="cultivation">Trồng Trọt</option>
            </select>
            <input
              value={newPenCam}
              onChange={(e) => setNewPenCam(e.target.value)}
              placeholder="IP Camera URL (tùy chọn)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[13px] outline-none"
            />
            <input
              value={newPenWebcam}
              onChange={(e) => setNewPenWebcam(e.target.value)}
              placeholder="Webcam ID (mặc định: 0)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[13px] outline-none"
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px]">
              Tạo Khu Vực
            </button>
          </form>
        </div>
      )}

      {showAddDevice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleAddDevice} className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold">Thêm Thiết Bị IoT</h3>
              <button type="button" onClick={() => setShowAddDevice(false)}><X className="w-4 h-4" /></button>
            </div>
            <input
              value={newDevName}
              onChange={(e) => setNewDevName(e.target.value)}
              placeholder="Tên thiết bị (VD: Quạt thông gió 2)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none"
              required
            />
            <input
              type="number"
              value={newDevPin}
              onChange={(e) => setNewDevPin(e.target.value)}
              placeholder="GPIO Pin (VD: 12)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none"
              required
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px]">
              Lưu Thiết Bị
            </button>
          </form>
        </div>
      )}

      {showConfigCam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCameraConfig} className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold">Cấu Hình Camera</h3>
              <button type="button" onClick={() => setShowConfigCam(false)}><X className="w-4 h-4" /></button>
            </div>
            <input
              value={editCamUrl}
              onChange={(e) => setEditCamUrl(e.target.value)}
              placeholder="IP Camera RTSP / HTTP URL"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[13px] outline-none"
            />
            <input
              value={editWebcamUrl}
              onChange={(e) => setEditWebcamUrl(e.target.value)}
              placeholder="Webcam Index / URL (mặc định: 0)"
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[13px] outline-none"
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px]">
              Lưu Cấu Hình
            </button>
          </form>
        </div>
      )}

      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onDetected={async (parsed: ParsedCropQr) => {
          setShowQrScanner(false);
          if (parsed.cropId) {
            let targetPen = parsed.penId;
            let cropName = `#${parsed.cropId}`;
            try {
              const { data } = await supabase.from('crops').select('pen_id,name').eq('id', parsed.cropId).maybeSingle();
              if (data?.pen_id && !targetPen) targetPen = String(data.pen_id);
              if (data?.name) cropName = data.name;
            } catch {}
            setCurrentMode('cultivation');
            setActiveTab('manage');
            if (targetPen) setCurrentPenId(targetPen);
            showToast(`Đã quét QR: ${cropName}`);
          } else if (parsed.raw.startsWith('http')) {
            window.open(parsed.raw, '_blank', 'noreferrer');
          } else {
            showToast(`Đã quét mã QR: ${parsed.raw}`);
          }
        }}
      />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-full shadow-lg">
          ⚡ {toastMsg}
        </div>
      )}

      {/* iOS Bottom Tab Bar */}
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
