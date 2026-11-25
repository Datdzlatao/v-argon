'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Video,
  Settings,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldCheck,
  Activity,
  AlertCircle,
  Eye,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Laptop,
  Columns,
} from 'lucide-react';
import {
  ACTION_API_URL,
  getActionVideoStreamWsUrl,
  getActionTrackerStatusAPI,
  getActionLogsAPI,
  stopPenCameraAPI,
} from '../lib/agent-api';
import WebSocketStreamPlayer from './WebSocketStreamPlayer';

interface FeedPenCameraProps {
  currentPenId: string;
  penName: string;
  penCameraUrl?: string;
  penWebcamUrl?: string;
  currentMode: 'livestock' | 'cultivation';
  onOpenConfigCamera: () => void;
  onNotification?: (title: string, desc: string) => void;
}

type StreamMode = 'ipcam' | 'webcam' | 'dual';

export default function FeedPenCamera({
  currentPenId,
  penName,
  penCameraUrl,
  penWebcamUrl = '0',
  currentMode,
  onOpenConfigCamera,
  onNotification,
}: FeedPenCameraProps) {
  const isLivestock = currentMode === 'livestock';

  // Chế độ luồng xem: IP Cam điện thoại / Webcam máy tính / Cả 2 luồng song song
  const [streamMode, setStreamMode] = useState<StreamMode>('ipcam');

  // Camera Stream Active State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Realtime FSM Telemetry State
  const [telemetry, setTelemetry] = useState<any>(null);
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState<boolean>(false);

  const pollIntervalRef = useRef<any>(null);
  const lastActionRef = useRef<string>('');

  // 1. Luồng IP Camera điện thoại / RTSP
  const videoFeedIpWsUrl = getActionVideoStreamWsUrl(currentPenId, 'ipcam', penCameraUrl);

  // 2. Luồng Webcam máy tính / USB
  const videoFeedWebcamWsUrl = getActionVideoStreamWsUrl(currentPenId, 'webcam', penWebcamUrl);

  // Khi người dùng chuyển sang chuồng khác hoặc đổi cấu hình -> cập nhật stream key và reset telemetry
  useEffect(() => {
    setStreamKey(Date.now());
    loadActionLogs();
    if (isCameraActive) {
      pollStatus();
    }
  }, [currentPenId, penCameraUrl, penWebcamUrl, streamMode]);

  // Polling Telemetry Loop khi camera đang bật
  useEffect(() => {
    if (!isCameraActive) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setTelemetry(null);
      return;
    }

    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 700);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isCameraActive, currentPenId, streamMode]);

  const pollStatus = async () => {
    const activeType = streamMode === 'dual' ? 'ipcam' : streamMode;
    const data = await getActionTrackerStatusAPI(currentPenId, activeType);
    if (data) {
      setTelemetry(data);

      // Bắn thông báo realtime nếu Gemini phát hiện hành động mới
      if (
        data.last_action &&
        data.last_action !== 'None' &&
        !data.last_action.includes('Chưa kết nối') &&
        data.last_action !== 'AI Analyzing...' &&
        data.last_action !== lastActionRef.current
      ) {
        lastActionRef.current = data.last_action;
        const actionLabel =
          data.last_action === 'FEEDING'
            ? 'Cho ăn'
            : data.last_action === 'WATERING'
            ? 'Tưới nước'
            : data.last_action === 'FERTILIZING'
            ? 'Bón phân'
            : data.last_action;

        if (onNotification) {
          onNotification(
            'Phát Hiện Hành Động AI',
            `Camera ${penName} phát hiện hành vi: ${actionLabel} (${data.last_action_reason || ''})`
          );
        }
        loadActionLogs();
      }
    }
  };

  const loadActionLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await getActionLogsAPI(currentPenId, 5);
      setActionLogs(res.data || []);
    } catch (e) {
      // ignore
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      stopPenCameraAPI(currentPenId, 'all').catch(() => {});
    } else {
      setIsConnecting(true);
      setStreamKey(Date.now());
      setIsCameraActive(true);
      setTimeout(() => setIsConnecting(false), 800);
    }
  };

  // State styling helper
  const fsmState = telemetry?.fsm_state || 'IDLE';
  const stateColorMap: Record<string, { bg: string; text: string; border: string }> = {
    IDLE: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
    SUSPENDED: { bg: 'bg-red-50 text-red-700', text: 'text-red-700', border: 'border-red-300' },
    RESUMED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    TRIGGERED: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-400' },
    COOLDOWN: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  };
  const activeColor = stateColorMap[fsmState] || stateColorMap.IDLE;

  const metrics = telemetry?.metrics || {};

  return (
    <div className="bg-fb-card rounded-2xl shadow-fb-card border border-fb-divider p-4 mb-4">
      {/* 1. Header Post */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-fb-divider gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-inner shrink-0">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-base text-fb-text flex items-center gap-2">
              <span>{isLivestock ? 'Camera Giám Sát Chuồng Nuôi AI' : 'Camera Giám Sát Vườn Trồng AI'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {penName}
              </span>
            </h4>
            <div className="text-xs text-fb-muted mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>IP Cam: <strong className="font-mono text-fb-text">{penCameraUrl || 'Chưa cấu hình (Port 8080)'}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-purple-600" />
                <span>Webcam: <strong className="font-mono text-fb-text">{penWebcamUrl || '0 (Mặc định)'}</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenConfigCamera}
            className="px-3 py-1.5 rounded-xl border border-fb-divider bg-fb-bg hover:bg-fb-hover text-xs font-semibold text-fb-text flex items-center gap-1.5 transition cursor-pointer"
            title="Cấu hình cả 2 luồng: IP Cam điện thoại & Webcam máy tính"
          >
            <Settings className="w-3.5 h-3.5 text-fb-muted" />
            <span>Cấu Hình 2 Luồng Cam</span>
          </button>

          <button
            onClick={toggleCamera}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
              isCameraActive
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Tắt Camera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Bật Camera Chuồng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Stream Switcher Tabs: IP Cam (Điện thoại) | Webcam (Máy tính) | Xem cả 2 luồng */}
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex p-1 bg-fb-bg rounded-xl border border-fb-divider text-xs font-semibold">
          <button
            onClick={() => setStreamMode('ipcam')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              streamMode === 'ipcam'
                ? 'bg-white text-emerald-700 shadow-sm font-bold border border-emerald-200'
                : 'text-fb-muted hover:text-fb-text'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>📱 IP Cam Điện Thoại</span>
          </button>

          <button
            onClick={() => setStreamMode('webcam')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              streamMode === 'webcam'
                ? 'bg-white text-emerald-700 shadow-sm font-bold border border-emerald-200'
                : 'text-fb-muted hover:text-fb-text'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-purple-600" />
            <span>💻 Webcam Máy Tính</span>
          </button>

          <button
            onClick={() => setStreamMode('dual')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              streamMode === 'dual'
                ? 'bg-white text-emerald-700 shadow-sm font-bold border border-emerald-200'
                : 'text-fb-muted hover:text-fb-text'
            }`}
          >
            <Columns className="w-3.5 h-3.5 text-emerald-600" />
            <span>👥 Xem Cả 2 Luồng (Song Song)</span>
          </button>
        </div>

        <div className="text-[11px] text-fb-muted flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Tự động đồng bộ với App Android</span>
        </div>
      </div>

      {/* 3. Main Viewport & Live Stats */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Video Viewport */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center min-h-[280px] shadow-inner">
          {isCameraActive ? (
            streamMode === 'dual' ? (
              // DUAL STREAM SPLIT VIEW (Xem cả 2 luồng song song qua WebSocket)
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full h-full p-2">
                <WebSocketStreamPlayer
                  wsUrl={videoFeedIpWsUrl}
                  altText={`IP Cam ${penName}`}
                  isActive={isCameraActive}
                  label="📱 IP Cam Điện Thoại"
                  badgeColor="bg-blue-500"
                />
                <WebSocketStreamPlayer
                  wsUrl={videoFeedWebcamWsUrl}
                  altText={`Webcam ${penName}`}
                  isActive={isCameraActive}
                  label="💻 Webcam Máy Tính"
                  badgeColor="bg-purple-500"
                />
              </div>
            ) : (
              // SINGLE STREAM VIEW (IP Cam hoặc Webcam Máy tính qua WebSocket Zero-Lag)
              <WebSocketStreamPlayer
                wsUrl={streamMode === 'webcam' ? videoFeedWebcamWsUrl : videoFeedIpWsUrl}
                altText={`Live Cam ${penName}`}
                isActive={isCameraActive}
                label={penName}
                subLabel={streamMode === 'webcam' ? '💻 Webcam Máy Tính' : '📱 IP Cam Điện Thoại'}
                cooldownText={
                  telemetry && telemetry.cooldown_remaining > 0
                    ? `Cooldown: ${telemetry.cooldown_remaining}s`
                    : undefined
                }
                badgeColor={streamMode === 'webcam' ? 'bg-purple-500' : 'bg-blue-500'}
              />
            )
          ) : (
            <div className="p-6 text-center text-slate-400 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-2.5 shadow">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-300">Camera Chuồng {penName} Đang Tắt</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Hỗ trợ 2 luồng độc lập: IP Camera điện thoại (RTSP/8080) và Webcam máy tính (USB/0). AI tự động phân tích hành vi và tư thế làm việc.
              </p>
              <button
                onClick={toggleCamera}
                className="mt-3.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Bật Camera ({streamMode === 'ipcam' ? '📱 IP Cam' : streamMode === 'webcam' ? '💻 Webcam' : '👥 Cả 2 Luồng'})</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: AI Vision & Posture Telemetry */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
          {/* FSM & Posture Card */}
          <div className="bg-fb-bg rounded-xl p-3 border border-fb-divider space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fb-text flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Trạng Thái Máy FSM
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${activeColor.bg} ${activeColor.text} ${activeColor.border}`}
              >
                {fsmState}
              </span>
            </div>

            {/* Metrics Bars */}
            <div className="space-y-1.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-fb-muted mb-0.5">
                  <span>Khớp Hông (Hip):</span>
                  <span className="font-mono font-semibold text-fb-text">
                    {(metrics.hip_vis || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-fb-divider rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      metrics.hip_vis > 0.7 ? 'bg-emerald-600' : metrics.hip_vis >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (metrics.hip_vis || 0) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-fb-muted mb-0.5">
                  <span>Cổ Tay (Wrist):</span>
                  <span className="font-mono font-semibold text-fb-text">
                    {(metrics.wrist_vis || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-fb-divider rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      metrics.wrist_vis > 0.7 ? 'bg-emerald-600' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (metrics.wrist_vis || 0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Geometry Highlights */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-fb-divider text-[11px]">
              <div className="bg-fb-card p-2 rounded-lg border border-fb-divider">
                <span className="text-fb-muted block text-[10px]">Góc Lưng:</span>
                <span className="font-bold text-fb-text font-mono">
                  {(metrics.torso_angle || 180).toFixed(1)}°
                </span>
              </div>
              <div className="bg-fb-card p-2 rounded-lg border border-fb-divider">
                <span className="text-fb-muted block text-[10px]">Tư Thế Cúi:</span>
                <span
                  className={`font-bold ${
                    metrics.is_bending ? 'text-emerald-700' : 'text-fb-muted'
                  }`}
                >
                  {metrics.is_bending ? 'Cúi & Vươn Tay' : 'Đứng Bình Thường'}
                </span>
              </div>
            </div>

            {/* Last Action Result */}
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-900 mb-0.5">
                <span className="flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Hành Vi Gần Nhất:
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-emerald-100 rounded text-emerald-800">
                  {telemetry?.last_action || 'Chưa ghi nhận'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 italic line-clamp-1">
                {telemetry?.last_action_reason || 'Đang theo dõi 2 luồng camera chuồng trại...'}
              </p>
            </div>
          </div>

          {/* Microservice Port Info */}
          <div className="text-[11px] text-fb-muted bg-fb-bg px-3 py-2 rounded-xl border border-fb-divider flex items-center justify-between">
            <span>⚡ AI Vision Engine: <strong className="font-mono text-fb-text">Port 8002</strong></span>
            <a
              href={`${ACTION_API_URL}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
            >
              <span>Dashboard Test</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 4. Recent Action Logs for THIS Pen */}
      <div className="mt-3.5 pt-3 border-t border-fb-divider">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-xs font-bold text-fb-text flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Lịch Sử Hành Động Ghi Nhận Tại {penName}</span>
          </h5>
          <button
            onClick={loadActionLogs}
            disabled={isRefreshingLogs}
            className="text-[11px] text-fb-muted hover:text-fb-text flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingLogs ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {actionLogs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {actionLogs.map((log: any, idx: number) => {
              const actName =
                log.action_type === 'FEEDING'
                  ? 'Cho Ăn'
                  : log.action_type === 'WATERING'
                  ? 'Tưới Nước'
                  : 'Bón Phân';
              return (
                <div
                  key={log.id || idx}
                  className="bg-fb-bg p-2.5 rounded-xl border border-fb-divider flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-fb-text">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{actName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-fb-divider/50 rounded font-normal text-fb-muted">
                        Nguồn: {log.trigger_source}
                      </span>
                    </div>
                    <p className="text-[11px] text-fb-muted mt-0.5 line-clamp-1">
                      {log.confidence_note || 'Đã ghi nhận kiểm chứng thành công.'}
                    </p>
                  </div>
                  <span className="text-[10px] text-fb-muted font-mono shrink-0">
                    {new Date(log.created_at || Date.now()).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-fb-muted italic py-1">
            Chưa có hành động nào được ghi nhận gần đây cho {penName}.
          </p>
        )}
      </div>
    </div>
  );
}
