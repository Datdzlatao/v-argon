'use client';

import React, { useState } from 'react';
import { VArgonLogo } from './VArgonLogo';
import {
  Sprout,
  Search,
  Bell,
  MessageCircle,
  Volume2,
  VolumeX,
  LogOut,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Sun,
  PawPrint,
  QrCode,
} from 'lucide-react';

interface NavbarProps {
  currentMode: 'livestock' | 'cultivation';
  onModeChange: (mode: 'livestock' | 'cultivation') => void;
  pens: Array<{ id: string; name: string; type: string }>;
  currentPenId: string;
  onPenChange: (penId: string) => void;
  userEmail: string;
  onLogout: () => void;
  alerts: Array<{ id: string; penName: string; issues: string[]; time: string }>;
  onOpenMessenger: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  unreadAlertsCount: number;
  wsConnected?: boolean;
  onTriggerBriefing?: () => void;
  onOpenQrScanner?: () => void;
}

export default function Navbar({
  currentMode,
  onModeChange,
  pens,
  currentPenId,
  onPenChange,
  userEmail,
  onLogout,
  alerts,
  onOpenMessenger,
  isMuted,
  onToggleMute,
  unreadAlertsCount,
  wsConnected = false,
  onTriggerBriefing,
  onOpenQrScanner,
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-[1440px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand & Search */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#15803D] flex items-center justify-center text-white shadow-sm shrink-0">
              <VArgonLogo className="w-5 h-5" variant="white" />
            </div>
            <div className="hidden sm:block leading-tight">
              <span className="block font-extrabold text-base tracking-tight text-slate-900 whitespace-nowrap">
                V-ARGON
              </span>
              <span className="block text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                AI &amp; IoT FarmOS
              </span>
            </div>
          </div>

          <div className="relative hidden xl:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                currentMode === 'livestock'
                  ? 'Tìm chuồng trại, đàn nuôi...'
                  : 'Tìm vườn cây, mùa vụ...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-100/90 text-xs rounded-xl pl-9 pr-3.5 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition border border-slate-200/70"
            />
          </div>
        </div>

        {/* Center: Mode Switcher */}
        <nav
          aria-label="Phân hệ trang trại"
          className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0"
        >
          <button
            type="button"
            onClick={() => onModeChange('livestock')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
              currentMode === 'livestock'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PawPrint className="w-4 h-4 shrink-0" />
            <span>Chăn Nuôi</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('cultivation')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
              currentMode === 'cultivation'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sprout className="w-4 h-4 shrink-0" />
            <span>Trồng Trọt</span>
          </button>
        </nav>

        {/* Right: Status, Pen Selector, Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Server status pill */}
          <div
            title={wsConnected ? 'Đã kết nối máy chủ trực tiếp theo thời gian thực' : 'Chưa kết nối máy chủ quản lý'}
            className={`hidden 2xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
              wsConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                wsConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>{wsConnected ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
          </div>

          {/* Morning briefing button */}
          {onTriggerBriefing && (
            <button
              type="button"
              onClick={onTriggerBriefing}
              title="Kích hoạt trợ lý tổng hợp bản tin sáng"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition whitespace-nowrap cursor-pointer"
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Bản Tin Sáng</span>
            </button>
          )}

          {/* External QR Scanner button */}
          {onOpenQrScanner && (
            <button
              type="button"
              onClick={onOpenQrScanner}
              title="Quét mã QR cây trồng để truy cập nhanh"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Quét QR</span>
            </button>
          )}

          {/* Pen Selector */}
          <div className="relative hidden lg:flex items-center bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-xs max-w-[175px]">
            <Layers className="w-3.5 h-3.5 text-emerald-700 mr-1.5 shrink-0" />
            <select
              value={currentPenId}
              onChange={(e) => onPenChange(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer truncate pr-1"
              aria-label="Chọn khu vực chuồng trại"
            >
              {pens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mute alarm */}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Bật chuông báo động' : 'Tắt chuông báo động'}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-700 transition cursor-pointer shrink-0"
            aria-label={isMuted ? 'Bật chuông báo động' : 'Tắt chuông báo động'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
          </button>

          {/* Notifications */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-700 transition relative cursor-pointer"
              aria-label="Xem thông báo trang trại"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                  <h3 className="font-bold text-sm text-slate-900">Thông Báo Trang Trại</h3>
                  <span className="text-xs text-emerald-700 font-bold">
                    {unreadAlertsCount} cần chú ý
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2">
                  {alerts.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                      Mọi khu vực đều an toàn và ổn định!
                    </div>
                  ) : (
                    alerts.map((alert, idx) => (
                      <div
                        key={alert.id || idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-rose-50/70 hover:bg-rose-50 transition border border-rose-200 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-xs flex-1 min-w-0">
                          <p className="font-bold text-rose-900 truncate">{alert.penName}</p>
                          <p className="text-rose-700 mt-0.5">Vấn đề: {alert.issues.join(', ')}</p>
                          <span className="text-[10px] text-rose-500 mt-1 block">{alert.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Open AI Assistant */}
          <button
            type="button"
            onClick={onOpenMessenger}
            title="Mở hộp thoại trợ lý nông nghiệp"
            className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 transition relative cursor-pointer shrink-0"
            aria-label="Mở hộp thoại trợ lý nông nghiệp"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
          </button>

          {/* User Avatar & Logout */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 ml-0.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shadow-sm select-none">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'N'}
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất tài khoản"
              className="w-8 h-8 rounded-xl hover:bg-rose-50 flex items-center justify-center text-slate-500 hover:text-rose-600 transition cursor-pointer"
              aria-label="Đăng xuất tài khoản"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
