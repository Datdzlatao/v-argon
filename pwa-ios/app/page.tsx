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
  ImagePlus,
  X,
  Briefcase,
} from 'lucide-react';
import WebSocketStreamPlayer from '../components/WebSocketStreamPlayer';
import GeminiMarkdown from '../components/GeminiMarkdown';
import IosManageModules from '../components/IosManageModules';
import {
  WS_URL,
  PenItem,
  fetchDashboardState,
  controlDevice,
  getActionVideoWsUrl,
  getActionTrackerStatus,
  getActionLogs,
  stopActionCamera,
  getFaceVideoWsUrl,
  startFaceCamera,
  stopFaceCamera,
  getFaceCameraLatest,
  sendAgentChat,
  sendAgentChatStream,
  getChatHistory,
  fetchNewsfeedState,
  executeNewsfeedQuickApi,
  NewsfeedItem,
  fileToBase64,
  diagnoseDiseaseWithBase64,
} from '../lib/api';

type TabKey = 'home' | 'camera' | 'attendance' | 'manage' | 'chat';

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
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pens, setPens] = useState<PenItem[]>([]);
  const [currentPenId, setCurrentPenId] = useState<string>('');
  const [env, setEnv] = useState<any>({});
  const [newsfeedItems, setNewsfeedItems] = useState<NewsfeedItem[]>([]);
  const [newsfeedSummary, setNewsfeedSummary] = useState<string>('');
  const [devices, setDevices] = useState<Record<string, boolean>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

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

  const currentPen = pens.find((p) => p.id === currentPenId) || pens[0];

  // Detect iOS standalone PWA mode
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  // Load initial dashboard state
  const loadDashboard = async (penId?: string) => {
    try {
      const data = await fetchDashboardState(penId);
      if (data?.pens?.length) {
        setPens(data.pens);
        if (!currentPenId) setCurrentPenId(data.pens[0].id);
      }
      if (data?.environment) setEnv(data.environment);
      if (data?.devices) {
        const map: Record<string, boolean> = {};
        if (Array.isArray(data.devices)) {
          data.devices.forEach((d: any) => {
            map[d.device_type || d.type] = Boolean(d.status ?? d.state);
          });
        } else {
          Object.assign(map, data.devices);
        }
        setDevices(map);
      }
    } catch {}
  };

function getOrCreatePwaUserId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000002';
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
    return '00000000-0000-4000-8000-000000000002';
  }
}

  useEffect(() => {
    loadDashboard(currentPenId || undefined);
    if (currentPenId) {
      getChatHistory(getOrCreatePwaUserId(), currentPenId).then((hist) => {
        if (hist && hist.length > 0) {
          setMessages(hist.map((m: any) => ({ sender: m.sender, text: m.content })));
        }
      });
    }
  }, [currentPenId]);

  const syncNewsfeed = async () => {
    const state = await fetchNewsfeedState(12, getOrCreatePwaUserId());
    if (state) {
      setNewsfeedItems(state.items || []);
      if (state.summary_text) setNewsfeedSummary(state.summary_text);
    }
  };

  useEffect(() => {
    syncNewsfeed();
    const timer = setInterval(syncNewsfeed, 10000);
    return () => clearInterval(timer);
  }, []);

  // Realtime Farm WebSocket
  useEffect(() => {
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
              setDevices((prev) => ({
                ...prev,
                [pkt.data.device_type]: Boolean(pkt.data.status),
              }));
              fetchNewsfeedState(12).then((s) => {
                if (s) {
                  setNewsfeedItems(s.items || []);
                  if (s.summary_text) setNewsfeedSummary(s.summary_text);
                }
              });
            } else if (pkt.event === 'newsfeed_update' && pkt.data?.items) {
              setNewsfeedItems(pkt.data.items);
              if (pkt.data.summary_text) setNewsfeedSummary(pkt.data.summary_text);
            } else if (pkt.event === 'chat_message' && pkt.data) {
              const d = pkt.data;
              if ((!d.user_id || d.user_id === 'ios_pwa_user') && d.content) {
                setMessages((prev) => {
                  const exists = prev.some((m) => m.sender === d.sender && m.text === d.content);
                  return exists ? prev : [...prev, { sender: d.sender, text: d.content }];
                });
              }
            } else if (pkt.event === 'alert') {
              fetchNewsfeedState(12).then((s) => {
                if (s) {
                  setNewsfeedItems(s.items || []);
                  if (s.summary_text) setNewsfeedSummary(s.summary_text);
                }
              });
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
  }, []);

  // Poll Action Telemetry when Camera tab is active
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

  // Poll Face & Uniform Telemetry when Face Cam is active
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

  const handleToggleDevice = async (type: string) => {
    const next = !devices[type];
    setDevices((prev) => ({ ...prev, [type]: next }));
    try {
      await controlDevice(type, next, currentPenId || undefined);
    } catch {
      setDevices((prev) => ({ ...prev, [type]: !next }));
    }
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
          } catch {
            setMessages((prev) => [...prev, { sender: 'agent', text: 'Không đọc được ảnh từ clipboard.' }]);
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
        await sendAgentChatStream(text, currentPenId || undefined, {
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

  const actionStatus = formatActionLabel(telemetry);
  const ipWsUrl = getActionVideoWsUrl(currentPenId || 'DEFAULT', 'ipcam', currentPen?.camera_url);
  const webcamWsUrl = getActionVideoWsUrl(currentPenId || 'DEFAULT', 'webcam', currentPen?.webcam_url || '0');

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      {/* iOS Top Glass Navigation Bar */}
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
              {wsConnected ? 'Live' : 'Kết nối...'}
            </span>
            <button
              onClick={() => loadDashboard(currentPenId || undefined)}
              className="w-8 h-8 rounded-full bg-black/5 active:bg-black/10 flex items-center justify-center"
              aria-label="Làm mới"
            >
              <RefreshCw className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Pen Selector Pills */}
        {pens.length > 0 && (
          <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto no-scrollbar items-center">
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
            <button
              onClick={async () => {
                const name = prompt('Nhập tên chuồng / khu vườn mới:');
                if (!name?.trim()) return;
                const type = confirm('Đây là khu Trồng trọt? (OK = Trồng trọt, Cancel = Chăn nuôi)') ? 'cultivation' : 'livestock';
                const id = `${type === 'cultivation' ? 'PEN-B' : 'PEN-A'}-${Date.now().toString().slice(-3)}`;
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
                await fetch(`${backendUrl}/api/pens`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id, name: name.trim(), type }),
                });
                await loadDashboard(id);
                setCurrentPenId(id);
              }}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              + Thêm khu
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 pt-3 pb-28 space-y-4 max-w-2xl w-full mx-auto">
        {/* iOS Add to Home Screen Banner (when opened in Safari) */}
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

        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <>
            {/* Live Observer News Feed */}
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  Bản tin quan sát trực tiếp
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
                          isCrit
                            ? 'bg-rose-50 border-rose-200'
                            : isWarn
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-white border-black/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-900">{item.title}</p>
                            <p className="text-[12px] text-slate-600 mt-0.5 leading-snug">{item.summary}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (item.pen_id && item.pen_id !== currentPenId) {
                                setCurrentPenId(item.pen_id);
                              }
                              if (item.quick_api) {
                                await executeNewsfeedQuickApi(item.quick_api.endpoint, item.quick_api.body).catch(() => {});
                                syncNewsfeed();
                              } else if (item.action_route === 'camera') {
                                setActiveTab('camera');
                              } else if (item.action_route === 'devices' || item.action_route === 'env') {
                                setActiveTab('home');
                              } else {
                                setActiveTab('chat');
                                if (item.target_id) {
                                  setChatInput(`Kiểm tra chi tiết ${item.target_id} tại ${item.title}`);
                                }
                              }
                            }}
                            className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white ${
                              item.is_resolved
                                ? 'bg-emerald-600'
                                : isCrit
                                ? 'bg-rose-600'
                                : 'bg-emerald-600'
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

            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 px-1 mb-2">
                Môi trường chuồng trại
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
            </section>

            {/* iOS Grouped List for IoT Devices */}
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 px-1 mb-2">
                Điều khiển thiết bị
              </h2>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-black/[0.06] overflow-hidden">
                {[
                  { key: 'fan', label: 'Quạt thông gió', icon: Fan, color: 'text-sky-600 bg-sky-50' },
                  { key: 'mist', label: 'Máy phun sương', icon: CloudRain, color: 'text-cyan-600 bg-cyan-50' },
                  { key: 'heater', label: 'Đèn sưởi ấm', icon: Flame, color: 'text-orange-600 bg-orange-50' },
                  { key: 'pump', label: 'Máy bơm / Tưới', icon: Sprout, color: 'text-emerald-600 bg-emerald-50' },
                ].map((item) => {
                  const Icon = item.icon;
                  const on = Boolean(devices[item.key]);
                  return (
                    <div key={item.key} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[15px] font-medium">{item.label}</span>
                      </div>
                      <button
                        onClick={() => handleToggleDevice(item.key)}
                        className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors ${
                          on ? 'bg-emerald-500' : 'bg-[#E9E9EA]'
                        }`}
                        aria-label={item.label}
                      >
                        <span
                          className={`block w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
                            on ? 'translate-x-[20px]' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* TAB 2: CAMERA AI (WebSocket Zero-Lag) */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            {/* iOS Segmented Control */}
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

            {/* Compact Current Action Status */}
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

        {/* TAB 3: FACE & UNIFORM ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-3">
            {isFaceCamOn ? (
              <WebSocketStreamPlayer
                wsUrl={getFaceVideoWsUrl(true)}
                isActive={isFaceCamOn}
                label="Quét mặt & Bảo hộ (WSS)"
              />
            ) : (
              <div className="bg-black rounded-2xl aspect-video flex flex-col items-center justify-center text-white p-6 text-center">
                <ScanFace className="w-10 h-10 text-white/40 mb-2" />
                <p className="text-[15px] font-semibold">Camera điểm danh đang tắt</p>
                <p className="text-[12px] text-white/60 mt-1">Đứng đủ toàn thân trước camera để kiểm tra bảo hộ</p>
              </div>
            )}

            <button
              onClick={handleToggleFaceCam}
              className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition ${
                isFaceCamOn ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              {isFaceCamOn ? 'Tắt Camera Điểm Danh' : 'Bật Camera Điểm Danh'}
            </button>

            {faceTelemetry && (
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-500">Trạng thái bảo hộ</span>
                  <span
                    className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-0.5 rounded-full ${
                      faceTelemetry.uniform?.is_correct
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {faceTelemetry.uniform?.is_correct ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {faceTelemetry.uniform?.status || 'Đang quét'}
                  </span>
                </div>
                {faceTelemetry.uniform?.message && (
                  <p className="text-[13px] text-slate-700 leading-snug">
                    {faceTelemetry.uniform.message}
                  </p>
                )}
                {Array.isArray(faceTelemetry.faces) && faceTelemetry.faces.length > 0 && (
                  <div className="pt-2 border-t border-black/5 text-[13px]">
                    <span className="text-slate-500">Nhân viên: </span>
                    <strong className="text-slate-900">
                      {faceTelemetry.faces[0].name || 'Người lạ'}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <IosManageModules
            penId={currentPenId}
            penName={currentPen?.name || 'Toàn Trang Trại'}
            penType={(currentPen as any)?.type || 'livestock'}
            pens={pens}
            onRefreshParent={() => loadDashboard(currentPenId || undefined)}
          />
        )}

        {/* TAB 4: AI CHAT */}
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
