'use client';

import React, { useState } from 'react';
import {
  Bot,
  ThumbsUp,
  MessageSquare,
  Share2,
  RefreshCw,
  Radio,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Zap,
  CheckCircle2,
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
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(12);
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

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount(likeCount - 1);
    } else {
      setLiked(true);
      setLikeCount(likeCount + 1);
    }
  };

  return (
    <div className="bg-fb-card rounded-2xl shadow-fb-card border border-fb-divider p-4 mb-4 overflow-hidden">
      {/* Tác giả bản tin / Trợ lý thông minh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-500 flex items-center justify-center text-white shadow">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm text-fb-text hover:underline cursor-pointer">
                Trợ Lý Nông Trại Thông Minh
              </h4>
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                ✓
              </span>
            </div>
            <p className="text-xs text-fb-muted flex items-center gap-1">
              Theo dõi tự động & Bản tin mỗi ngày • {isLivestock ? '🐖 Khu Chăn Nuôi' : '🌿 Khu Trồng Trọt'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(onTriggerBriefing || onRefreshNewsfeed) && (
            <button
              onClick={() => {
                onRefreshNewsfeed?.();
                onTriggerBriefing?.();
              }}
              disabled={isLoading}
              title="Cập nhật bản tin theo dõi & tổng hợp dữ liệu nông trại"
              className="text-xs flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Đang tạo...' : 'Làm Mới'}</span>
            </button>
          )}

          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" />
            TRỰC TIẾP
          </span>
        </div>
      </div>

      {/* Nội dung bản tin hợp nhất */}
      <div className="mt-3 text-sm text-fb-text space-y-2.5">
        {briefingText ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm text-slate-800 max-h-48 overflow-y-auto break-words">
            <GeminiMarkdown text={briefingText} />
          </div>
        ) : (
          <p className="leading-relaxed text-xs sm:text-sm text-fb-text">
            Kính chào bà con! ☀️ Hệ thống quan sát trực tiếp 24/7 và tổng hợp các đầu việc cần ưu tiên xử lý ngay hôm nay:
          </p>
        )}

        {/* Lưới điểm tin nhanh */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 pb-1">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <div className="text-xs text-fb-muted">Công việc trong ngày</div>
              <div className="font-bold text-sm text-fb-text">{pendingTasksCount} nhiệm vụ</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="text-xs text-orange-700">Kho sắp hết</div>
              <div className="font-bold text-sm text-orange-800">{lowStockCount} mặt hàng</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2">
            <span className="text-xl">{isLivestock ? '🩺' : '🌿'}</span>
            <div>
              <div className="text-xs text-rose-700">
                {isLivestock ? 'Vật nuôi cần chú ý' : 'Cây trồng cần tưới/chăm'}
              </div>
              <div className="font-bold text-sm text-rose-800">
                {sickAnimalsCount} {isLivestock ? 'cá thể' : 'vụ/luống'}
              </div>
            </div>
          </div>
        </div>

        {/* Luồng quan sát trực tiếp tích hợp */}
        {newsfeedItems.length > 0 ? (
          <div className="space-y-2 pt-1 max-h-[300px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              <span>Cảnh báo & sự kiện mới nhất ({newsfeedItems.length})</span>
              {newsfeedItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllFeed((v) => !v)}
                  className="text-emerald-700 hover:underline normal-case font-semibold cursor-pointer"
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
                  className={`rounded-xl border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isCritical
                      ? 'bg-rose-50/70 border-rose-200'
                      : isWarning
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{item.title}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5 line-clamp-3 break-words">
                        <GeminiMarkdown text={item.summary || ''} />
                      </div>
                    </div>
                  </div>

                  {onQuickAction && (
                    <button
                      onClick={() => handleAction(item)}
                      disabled={busyId === item.id}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 ${
                        doneIds[item.id] || item.is_resolved
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
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hệ thống quan sát 24/7 chưa ghi nhận cảnh báo mới. Mọi khu vực đang ổn định!</span>
          </div>
        )}
      </div>

      {/* Lượt tương tác */}
      <div className="flex items-center justify-between text-xs text-fb-muted pt-3 pb-2 border-b border-fb-divider mt-2">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px]">
            👍
          </span>
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px]">
            ❤️
          </span>
          <span>{likeCount} thành viên đã xem</span>
        </div>
        <span>3 câu hỏi tư vấn</span>
      </div>

      {/* Các nút tương tác */}
      <div className="grid grid-cols-3 gap-1 pt-1 mt-1 text-xs font-semibold text-fb-muted">
        <button
          onClick={handleLike}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition cursor-pointer ${
            liked ? 'text-emerald-700 font-bold bg-emerald-50' : 'hover:bg-fb-hover text-fb-muted'
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-emerald-600 text-emerald-600' : ''}`} />
          <span>Hữu ích ({likeCount})</span>
        </button>

        <button
          onClick={onOpenChat}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-fb-hover text-fb-muted transition cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>Hỏi chi tiết</span>
        </button>

        <button
          onClick={() => alert('Đã sao chép liên kết bản tin!')}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-fb-hover text-fb-muted transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Chia sẻ</span>
        </button>
      </div>
    </div>
  );
}
