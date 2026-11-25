'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WebSocketStreamPlayerProps {
  wsUrl: string;
  isActive: boolean;
  label?: string;
}

export default function WebSocketStreamPlayer({
  wsUrl,
  isActive,
  label,
}: WebSocketStreamPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!isActive || !wsUrl) {
      setIsConnected(false);
      setFps(0);
      return;
    }

    let ws: WebSocket | null = null;
    let isCleanedUp = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    frameCountRef.current = 0;
    const fpsTimer = setInterval(() => {
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
          setIsConnected(true);
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
                if (ctx) ctx.drawImage(bmp, 0, 0);
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
            // ignore decode error
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
          setIsConnected(false);
          if (!isCleanedUp) {
            reconnectTimer = setTimeout(connect, 1500);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isCleanedUp) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      }
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fpsTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [wsUrl, isActive]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />

      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span>{label || 'WSS Live'}</span>
      </div>

      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-mono font-semibold text-emerald-300">
        {fps > 0 ? `${fps} FPS` : 'WSS'}
      </div>

      {!isConnected && isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-medium text-white/80">Đang kết nối WebSocket...</span>
        </div>
      )}
    </div>
  );
}
