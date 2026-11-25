'use client';

import React, { useState } from 'react';
import {
  Radio,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { NewsfeedItem } from '../lib/agent-api';

interface FeedNewsfeedCardProps {
  items: NewsfeedItem[];
  isLoading?: boolean;
  onRefresh: () => void;
  onQuickAction: (item: NewsfeedItem) => Promise<void> | void;
}

export default function FeedNewsfeedCard({
  items,
  isLoading = false,
  onRefresh,
  onQuickAction,
}: FeedNewsfeedCardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});

  const handleAction = async (item: NewsfeedItem) => {
    setBusyId(item.id);
    try {
      await onQuickAction(item);
      if (item.quick_api) {
        setDoneIds((prev) => ({ ...prev, [item.id]: true }));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-fb-card rounded-2xl shadow-fb-card border border-fb-divider p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
            <Radio className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-fb-text">Bản Tin Theo Dõi Trực Tiếp</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                THEO DÕI 24/7
              </span>
            </div>
            <p className="text-[11px] text-fb-muted">
              Hệ thống tự động theo dõi 24/7 và gửi cảnh báo kèm nút xử lý nhanh
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Cập nhật</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 px-3.5 py-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Hệ thống quan sát chưa ghi nhận sự cố hay cảnh báo mới nào. Mọi khu vực đang ổn định!</span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {items.map((item) => {
            const isCritical = item.severity === 'critical';
            const isWarning = item.severity === 'warning';
            const borderCls = isCritical
              ? 'bg-rose-50/70 border-rose-200'
              : isWarning
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-slate-50 border-slate-200';
            const badgeCls = isCritical
              ? 'bg-rose-600 text-white'
              : isWarning
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white';

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${borderCls}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${badgeCls}`}>
                    {isCritical ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : isWarning ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">{item.title}</span>
                      {item.pen_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-600 font-medium">
                          {item.pen_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{item.summary}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAction(item)}
                  disabled={busyId === item.id}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 ${
                    doneIds[item.id] || (item as any).is_resolved
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isCritical
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {item.quick_api ? <Zap className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>
                    {doneIds[item.id]
                      ? 'Đã xử lý'
                      : busyId === item.id
                      ? 'Đang xử lý...'
                      : item.action_label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
