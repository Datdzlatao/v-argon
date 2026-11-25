'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export interface WebSocketStreamPlayerProps {
  wsUrl: string;
  altText: string;
  isActive: boolean;
  label?: string;
  subLabel?: string;
  cooldownText?: string;
  badgeColor?: string;
  showOverlayBadges?: boolean;
}

export default function WebSocketStreamPlayer({
  wsUrl,
  altText,
  isActive,
  label = 'Camera',
  subLabel,
  cooldownText,
  badgeColor = 'bg-blue-500',
  showOverlayBadges = true,
}: WebSocketStreamPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) {
      setIsWsConnected(false);
      setFps(0);
      return;
    }

    let ws: WebSocket | null = null;
    let isCleanedUp = false;
    let reconnectTimeout: any = null;

    // Đo FPS thực tế nhận từ WebSocket trên Client
    frameCountRef.current = 0;
    fpsTimerRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    const connect = () => {
      if (isCleanedUp) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'blob';

        ws.onopen = () => {
          if (isCleanedUp) {
            ws?.close();
            return;
          }
          setIsWsConnected(true);
        };

        let isDecoding = false;
        let pendingBlob: Blob | null = null;

        const renderBlob = async (blob: Blob) => {
          if (isCleanedUp) return;
          isDecoding = true;
          try {
            if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
              const bmp = await createImageBitmap(blob);
              const canvas = canvasRef.current;
              if (canvas) {
                if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
                  canvas.width = bmp.width;
                  canvas.height = bmp.height;
                }
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(bmp, 0, 0);
                }
              }
              bmp.close();
            } else {
              await new Promise<void>((resolve) => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                  const canvas = canvasRef.current;
                  if (canvas) {
                    if (canvas.width !== img.width || canvas.height !== img.height) {
                      canvas.width = img.width;
                      canvas.height = img.height;
                    }
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.drawImage(img, 0, 0);
                  }
                  URL.revokeObjectURL(url);
                  resolve();
                };
                img.onerror = () => {
                  URL.revokeObjectURL(url);
                  resolve();
                };
                img.src = url;
              });
            }
          } catch {
            // Frame decode error - ignore
          } finally {
            isDecoding = false;
            if (!isCleanedUp && ws && ws.readyState === WebSocket.OPEN) {
              if (pendingBlob) {
                const next = pendingBlob;
                pendingBlob = null;
                void renderBlob(next);
              } else {
                try {
                  ws.send('ack');
                } catch {}
              }
            }
          }
        };

        ws.onmessage = (event) => {
          if (isCleanedUp) return;
          if (event.data instanceof Blob) {
            frameCountRef.current += 1;
            if (isDecoding) {
              pendingBlob = event.data;
            } else {
              void renderBlob(event.data);
            }
          }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          if (!isCleanedUp) {
            reconnectTimeout = setTimeout(connect, 1500);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isCleanedUp) {
          reconnectTimeout = setTimeout(connect, 1500);
        }
      }
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [wsUrl, isActive]);

  return (
    <div className="relative w-full h-full aspect-video flex items-center justify-center bg-slate-950 overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-label={altText}
        className="w-full h-full object-contain"
      />

      {showOverlayBadges && (
        <>
          {/* Pill trạng thái góc trên trái */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-2 bg-slate-900/85 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-700/70 text-[11px] text-white pointer-events-none">
            <span className={`w-2 h-2 rounded-full ${badgeColor} ${isWsConnected ? 'animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-semibold">{label}</span>
            {subLabel && (
              <span className="text-emerald-400 font-mono text-[10px]">[{subLabel}]</span>
            )}
          </div>

          {/* Pill giao thức & FPS góc trên phải */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
            <div className="bg-emerald-950/80 border border-emerald-600/60 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] text-emerald-300 font-mono flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>⚡ Kết nối trực tiếp</span>
              {fps > 0 && <span className="text-emerald-200 font-bold">• {fps} ảnh/giây</span>}
            </div>

            {cooldownText && (
              <div className="bg-amber-950/80 backdrop-blur px-2 py-0.5 rounded-lg border border-amber-600/60 text-[10px] text-amber-300 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{cooldownText}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Loading overlay khi đang khởi tạo WebSocket */}
      {!isWsConnected && isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm pointer-events-none">
          <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-xs text-slate-300 font-semibold tracking-wide">Đang bắt tay luồng WSS...</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Mã hóa TLS 1.3 & Khử Buffer Bloat</span>
        </div>
      )}
    </div>
  );
}
