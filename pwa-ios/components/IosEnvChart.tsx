'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface HistoryPoint {
  temp?: number;
  temperature?: number;
  hum?: number;
  humidity?: number;
  smell?: number;
  nh3?: number;
  created_at?: string;
}

export default function IosEnvChart({
  historyLogs,
  onAskAI,
}: {
  historyLogs: HistoryPoint[];
  onAskAI: () => void;
}) {
  const points = (historyLogs || []).slice(-16);

  const buildPath = (values: number[], minVal: number, maxVal: number) => {
    if (values.length < 2) return '';
    const w = 300;
    const h = 88;
    const span = Math.max(1, maxVal - minVal);
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - minVal) / span) * (h - 14) - 7;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const temps = points.map((p) => Number(p.temperature ?? p.temp ?? 28));
  const hums = points.map((p) => Number(p.humidity ?? p.hum ?? 70));

  const tempPath = buildPath(temps, 15, 45);
  const humPath = buildPath(hums, 20, 100);

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">Biểu đồ biến động 24h</h3>
          <p className="text-[11px] text-slate-500">Nhiệt độ (°C) &amp; Độ ẩm (%)</p>
        </div>
        <button
          type="button"
          onClick={onAskAI}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Hỏi AI
        </button>
      </div>

      {points.length >= 2 ? (
        <div className="w-full">
          <svg viewBox="0 0 300 88" className="w-full h-24 overflow-visible">
            <line x1="0" y1="22" x2="300" y2="22" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="54" x2="300" y2="54" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
            {humPath && <path d={humPath} fill="none" stroke="#0EA5E9" strokeWidth="2.2" strokeLinecap="round" />}
            {tempPath && <path d={tempPath} fill="none" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />}
          </svg>
          <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-red-500 inline-block" /> Nhiệt độ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-sky-500 inline-block" /> Độ ẩm
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-slate-400 py-3 text-center">
          Đang thu thập dữ liệu lịch sử cảm biến...
        </p>
      )}
    </div>
  );
}
