'use client';

import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import './ios.css';
import WebSocketStreamPlayer from '../../components/WebSocketStreamPlayer';
import {
  BACKEND_URL,
  WS_URL,
  getActionVideoStreamWsUrl,
  getFaceVideoStreamWsUrl,
  getActionTrackerStatusAPI,
  getActionLogsAPI,
  stopPenCameraAPI,
  startCameraDeviceAPI,
  stopCameraDeviceAPI,
  getCameraLatestTelemetryAPI,
  controlDeviceViaAPI,
  sendAgentChat,
} from '../../lib/agent-api';

type TabKey = 'home' | 'camera' | 'attendance' | 'chat';

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
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pens, setPens] = useState<PenItem[]>([]);
  const [currentPenId, setCurrentPenId] = useState<string>('');
  const [env, setEnv] = useState<any>({});
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
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([
    { sender: 'agent', text: 'Xin chào! Tôi là Trợ lý Smart Farm AI. Bạn cần kiểm tra chuồng trại hay điều khiển thiết bị nào?' },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const currentPen = pens.find((p) => p.id === currentPenId) || pens[0];

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  const loadDashboard = async (penId?: string) => {
    try {
      const url = penId
        ? `${BACKEND_URL}/api/dashboard?pen_id=${encodeURIComponent(penId)}`
        : `${BACKEND_URL}/api/dashboard`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
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

  useEffect(() => {
    loadDashboard(currentPenId || undefined);
  }, [currentPenId]);

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

  useEffect(() => {
    if (!isActionCamOn || !currentPenId) return;
    const poll = async () => {
      const type = streamMode === 'dual' ? 'ipcam' : streamMode;
      const [st, logsRes] = await Promise.all([
        getActionTrackerStatusAPI(currentPenId, type),
        getActionLogsAPI(currentPenId, 5),
      ]);
      if (st) setTelemetry(st);
      setActionLogs(logsRes?.data || []);
    };
    poll();
    const id = setInterval(poll, 900);
    return () => clearInterval(id);
  }, [isActionCamOn, currentPenId, streamMode]);

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

  const handleToggleDevice = async (type: string) => {
    const next = !devices[type];
    setDevices((prev) => ({ ...prev, [type]: next }));
    try {
      await controlDeviceViaAPI(currentPenId || 'DEFAULT', type, next ? 'turn_on' : 'turn_off');
    } catch {
      setDevices((prev) => ({ ...prev, [type]: !next }));
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

  const handleToggleFaceCam = async () => {
    if (isFaceCamOn) {
      setIsFaceCamOn(false);
      await stopCameraDeviceAPI().catch(() => {});
    } else {
      setIsFaceCamOn(true);
      await startCameraDeviceAPI('0', -1).catch(() => {});
    }
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || isSendingChat) return;
    setChatInput('');
    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setIsSendingChat(true);
    try {
      const res = await sendAgentChat(text, currentPenId || undefined, 'ios_pwa_user');
      setMessages((prev) => [...prev, { sender: 'agent', text: res.reply || 'Đã xử lý.' }]);
    } catch {
      setMessages((prev) => [...prev, { sender: 'agent', text: 'Không kết nối được tới máy chủ AI.' }]);
    } finally {
      setIsSendingChat(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const actionStatus = formatActionLabel(telemetry);
  const ipWsUrl = getActionVideoStreamWsUrl(currentPenId || 'DEFAULT', 'ipcam', currentPen?.camera_url);
  const webcamWsUrl = getActionVideoStreamWsUrl(currentPenId || 'DEFAULT', 'webcam', currentPen?.webcam_url || '0');

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      <header className="sticky top-0 z-30 ios-glass ios-safe-top border-b border-black/10">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              Smart Farm iOS
            </p>
            <h1 className="text-[20px] font-bold tracking-tight leading-tight">
              {activeTab === 'home' && 'Tổng quan trang trại'}
              {activeTab === 'camera' && 'Camera AI Giám sát'}
              {activeTab === 'attendance' && 'Quét mặt & Bảo hộ'}
              {activeTab === 'chat' && 'Trợ lý Nông trại AI'}
            </h1>
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

      <main className="flex-1 px-4 pt-3 pb-28 space-y-4 max-w-2xl w-full mx-auto">
        {!isStandalone && (
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Share className="w-5 h-5" />
            </div>
            <div className="text-[12px] leading-snug text-slate-600">
              <strong className="text-slate-900 block">Cài đặt như App iPhone:</strong>
              Bấm nút <strong>Chia sẻ (Share)</strong> ở thanh dưới Safari → chọn{' '}
              <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <>
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
            {isFaceCamOn ? (
              <div className="rounded-2xl overflow-hidden">
                <WebSocketStreamPlayer
                  wsUrl={getFaceVideoStreamWsUrl(true)}
                  altText="Quét mặt & Bảo hộ"
                  isActive={isFaceCamOn}
                  label="Quét mặt & Bảo hộ (WSS)"
                />
              </div>
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

        {activeTab === 'chat' && (
          <div className="flex flex-col space-y-3">
            <div className="space-y-2.5">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 bg-white rounded-full p-1.5 pl-4 shadow-sm border border-black/5">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Nhắn cho Smart Farm AI..."
                className="flex-1 bg-transparent text-[15px] outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={isSendingChat || !chatInput.trim()}
                className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 ios-glass ios-safe-bottom border-t border-black/10">
        <div className="max-w-2xl mx-auto grid grid-cols-4 h-[54px]">
          {[
            { key: 'home', label: 'Tổng quan', icon: Home },
            { key: 'camera', label: 'Camera AI', icon: Video },
            { key: 'attendance', label: 'Điểm danh', icon: ScanFace },
            { key: 'chat', label: 'Trợ lý AI', icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex flex-col items-center justify-center gap-0.5 transition ${
                  active ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
