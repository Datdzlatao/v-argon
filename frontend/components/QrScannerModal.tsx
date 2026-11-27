'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, QrCode, Upload, X, AlertCircle } from 'lucide-react';

export interface ParsedCropQr {
  cropId?: string;
  penId?: string;
  raw: string;
}

export function parseCropQrPayload(raw: string): ParsedCropQr {
  const text = (raw || '').trim();
  if (!text) return { raw: text };

  // 1. JSON format {"crop_id": ..., "pen_id": ...}
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj.crop_id || obj.cropId) {
        return {
          cropId: String(obj.crop_id ?? obj.cropId),
          penId: obj.pen_id ?? obj.penId ? String(obj.pen_id ?? obj.penId) : undefined,
          raw: text,
        };
      }
    } catch {}
  }

  // 2. URL or deep-link with ?crop_id=...&pen_id=...
  try {
    const url = new URL(text.startsWith('smartfarm://') ? text.replace('smartfarm://', 'https://smartfarm.local/') : text);
    const cropId = url.searchParams.get('crop_id') || url.searchParams.get('cropId');
    const penId = url.searchParams.get('pen_id') || url.searchParams.get('penId') || undefined;
    if (cropId) {
      return { cropId, penId, raw: text };
    }
  } catch {}

  // 3. Simple "crop:123"
  const m = text.match(/^crop:(\d+)/i);
  if (m) {
    return { cropId: m[1], raw: text };
  }

  return { raw: text };
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onDetected,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (parsed: ParsedCropQr) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [camError, setCamError] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCamError('');

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCamError('Trình duyệt không hỗ trợ camera trực tiếp. Hãy tải ảnh QR lên bên dưới.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanLoop = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
                if (code?.data) {
                  stopCamera();
                  onDetected(parseCropQrPayload(code.data));
                  return;
                }
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanLoop);
        };
        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (err: any) {
        setCamError(err?.message || 'Không thể mở camera. Bạn có thể chọn ảnh mã QR để quét.');
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, onDetected]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, canvas.width, canvas.height);
      if (code?.data) {
        stopCamera();
        onDetected(parseCropQrPayload(code.data));
      } else {
        setCamError('Không tìm thấy mã QR hợp lệ trong ảnh đã chọn.');
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Quét Mã QR Cây Trồng</h3>
              <p className="text-[11px] text-slate-500">Đưa mã QR vào khung camera để truy cập nhanh</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square max-h-72 mx-auto flex items-center justify-center">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none" />
            {camError && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-5 text-white gap-2">
                <Camera className="w-8 h-8 text-slate-400" />
                <p className="text-xs text-slate-200">{camError}</p>
              </div>
            )}
          </div>

          <label className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>Hoặc chọn ảnh chứa mã QR</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualInput.trim()) return;
              stopCamera();
              onDetected(parseCropQrPayload(manualInput));
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Hoặc dán link / mã QR cây trồng..."
              className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Mở
            </button>
          </form>

          {camError && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Nếu dùng HTTP không phải localhost, trình duyệt có thể chặn camera; hãy dùng HTTPS hoặc chọn ảnh QR.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
