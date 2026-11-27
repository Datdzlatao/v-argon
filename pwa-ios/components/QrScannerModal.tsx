'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, QrCode, Upload, X } from 'lucide-react';

export interface ParsedCropQr {
  cropId?: string;
  penId?: string;
  raw: string;
}

export function parseCropQrPayload(raw: string): ParsedCropQr {
  const text = (raw || '').trim();
  if (!text) return { raw: text };

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

  try {
    const url = new URL(text.startsWith('smartfarm://') ? text.replace('smartfarm://', 'https://smartfarm.local/') : text);
    const cropId = url.searchParams.get('crop_id') || url.searchParams.get('cropId');
    const penId = url.searchParams.get('pen_id') || url.searchParams.get('penId') || undefined;
    if (cropId) return { cropId, penId, raw: text };
  } catch {}

  const m = text.match(/^crop:(\d+)/i);
  if (m) return { cropId: m[1], raw: text };

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
          setCamError('Trình duyệt không hỗ trợ camera trực tiếp. Hãy chọn ảnh mã QR.');
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h3 className="text-[15px] font-bold text-slate-900">Quét mã QR cây trồng</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square max-h-64 mx-auto flex items-center justify-center">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none" />
            {camError && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-4 text-white gap-2">
                <Camera className="w-8 h-8 text-slate-400" />
                <p className="text-[12px] text-slate-200">{camError}</p>
              </div>
            )}
          </div>

          <label className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Chọn ảnh chứa mã QR</span>
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
              placeholder="Hoặc dán mã / link QR cây trồng..."
              className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-[12px]"
            />
            <button type="submit" className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">
              Mở
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
