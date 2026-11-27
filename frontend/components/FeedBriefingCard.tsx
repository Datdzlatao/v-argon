'use client';

import React, { useState } from 'react';
import {
  Bot,
  MessageSquare,
  RefreshCw,
  Radio,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Zap,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Sprout,
  PackageOpen,
} from 'lucide-react';
import { NewsfeedItem } from '../lib/agent-api';
import GeminiMarkdown from './GeminiMarkdown';

interface FeedBriefingCardProps {
  onOpenChat: () => void;
  pendingTasksCount?: number;
  lowStockCount?: number;
  sickAnimalsCount?: number;
  briefingText?: string;
  onTriggerBriefing?: () => void;
  isLoading?: boolean;
  currentMode?: 'livestock' | 'cultivation';
  newsfeedItems?: NewsfeedItem[];
  onRefreshNewsfeed?: () => void;
  onQuickAction?: (item: NewsfeedItem) => Promise<void> | void;
}

export default function FeedBriefingCard({
  onOpenChat,
  pendingTasksCount = 2,
  lowStockCount = 1,
  sickAnimalsCount = 1,
  briefingText,
  onTriggerBriefing,
  isLoading = false,
  currentMode = 'livestock',
  newsfeedItems = [],
  onRefreshNewsfeed,
  onQuickAction,
}: FeedBriefingCardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const [showAllFeed, setShowAllFeed] = useState(false);

  const isLivestock = currentMode === 'livestock';

  const handleAction = async (item: NewsfeedItem) => {
    if (!onQuickAction) return;
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-600 flex items-center justify-center text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-900 truncate">
                Bản Tin Điều Hành Trang Trại
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                <Radio className="w-3 h-3 text-emerald-600" />
                TRỰC TIẾP
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {isLivestock ? 'Phân hệ Chăn Nuôi' : 'Phân hệ Trồng Trọt'} • Tổng hợp tự động 24/7
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(onTriggerBriefing || onRefreshNewsfeed) && (
            <button
              type="button"
              onClick={() => {
                onRefreshNewsfeed?.();
                onTriggerBriefing?.();
              }}
              disabled={isLoading}
              title="Cập nhật bản tin theo dõi & tổng hợp dữ liệu nông trại"
              className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold rounded-xl border border-slate-200 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Đang tạo...' : 'Làm Mới'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenChat}
            className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm transition whitespace-nowrap cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Hỏi Trợ Lý AI</span>
          </button>
        </div>
      </div>

      {/* Briefing Body */}
      <div className="mt-4 space-y-3.5">
        {briefingText ? (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-800 max-h-44 overflow-y-auto break-words leading-relaxed">
            <GeminiMarkdown text={briefingText} />
          </div>
        ) : (
          <p className="leading-relaxed text-xs sm:text-sm text-slate-600">
            Hệ thống đang giám sát 24/7 và tổng hợp các đầu việc cần ưu tiên xử lý hôm nay:
          </p>
        )}

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">Công việc hôm nay</div>
              <div className="font-bold text-sm text-slate-900 whitespace-nowrap">{pendingTasksCount} nhiệm vụ</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <PackageOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-amber-800 whitespace-nowrap">Kho sắp hết</div>
              <div className="font-bold text-sm text-amber-950 whitespace-nowrap">{lowStockCount} mặt hàng</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              {isLivestock ? <HeartPulse className="w-4 h-4" /> : <Sprout className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-rose-800 whitespace-nowrap">
                {isLivestock ? 'Vật nuôi cần chú ý' : 'Cây cần chăm sóc'}
              </div>
              <div className="font-bold text-sm text-rose-950 whitespace-nowrap">
                {sickAnimalsCount} {isLivestock ? 'cá thể' : 'vụ/luống'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Newsfeed Stream */}
        {newsfeedItems.length > 0 ? (
          <div className="space-y-2 pt-1 max-h-[280px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Cảnh báo &amp; sự kiện mới nhất ({newsfeedItems.length})</span>
              {newsfeedItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllFeed((v) => !v)}
                  className="text-emerald-700 hover:underline normal-case font-semibold cursor-pointer whitespace-nowrap"
                >
                  {showAllFeed ? 'Thu gọn' : `Xem thêm (${newsfeedItems.length - 3})`}
                </button>
              )}
            </div>
            {(showAllFeed ? newsfeedItems : newsfeedItems.slice(0, 3)).map((item) => {
              const isCritical = item.severity === 'critical';
              const isWarning = item.severity === 'warning';
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isCritical
                      ? 'bg-rose-50/60 border-rose-200'
                      : isWarning
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white ${
                        isCritical ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : isWarning ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Info className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">{item.title}</span>
                      <div className="text-xs text-slate-600 mt-0.5 line-clamp-2 break-words">
                        <GeminiMarkdown text={item.summary || ''} />
                      </div>
                    </div>
                  </div>

                  {onQuickAction && (
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      disabled={busyId === item.id}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                        doneIds[item.id] || item.is_resolved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      {item.quick_api ? <Zap className="w-3.5 h-3.5 shrink-0" /> : <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
                      <span>
                        {doneIds[item.id]
                          ? 'Đã xử lý'
                          : busyId === item.id
                          ? 'Đang xử lý...'
                          : item.action_label}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hệ thống quan sát 24/7 chưa ghi nhận cảnh báo mới. Mọi khu vực đang ổn định.</span>
          </div>
        )}
      </div>
    </div>
  );
}
