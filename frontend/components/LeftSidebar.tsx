'use client';

import React from 'react';
import {
  Layers,
  Plus,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  PawPrint,
  Sprout,
} from 'lucide-react';

interface LeftSidebarProps {
  userEmail: string;
  currentMode: 'livestock' | 'cultivation';
  onModeChange: (mode: 'livestock' | 'cultivation') => void;
  pens: Array<{ id: string; name: string; type: string; hasAlert?: boolean }>;
  currentPenId: string;
  onSelectPen: (penId: string) => void;
  onOpenAddPenModal: () => void;
}

export default function LeftSidebar({
  userEmail,
  currentMode,
  onModeChange,
  pens,
  currentPenId,
  onSelectPen,
  onOpenAddPenModal,
}: LeftSidebarProps) {
  return (
    <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20 self-start">
      {/* Manager Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm select-none shrink-0">
          {userEmail ? userEmail.charAt(0).toUpperCase() : 'N'}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm text-slate-900 truncate">Quản Lý Trang Trại</h4>
          <p className="text-xs text-slate-500 truncate">{userEmail || 'Chủ trang trại'}</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80">
        <div className="text-[11px] font-bold text-slate-500 px-1.5 pb-2 uppercase tracking-wider">
          Phân Hệ Trang Trại
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onModeChange('livestock')}
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
              currentMode === 'livestock'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <PawPrint className="w-3.5 h-3.5 shrink-0" />
            <span>Chăn Nuôi</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('cultivation')}
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
              currentMode === 'cultivation'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 shrink-0" />
            <span>Trồng Trọt</span>
          </button>
        </div>
      </div>

      {/* Pen / Garden List */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5 gap-2">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
            <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
            {currentMode === 'livestock' ? 'Khu Chuồng Nuôi' : 'Khu Vườn Cây'}
          </span>

          <button
            type="button"
            onClick={onOpenAddPenModal}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 whitespace-nowrap hover:underline cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm Mới
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {pens.map((pen) => {
            const isSelected = pen.id === currentPenId;
            const hasAlert = pen.hasAlert;

            return (
              <div
                key={pen.id}
                onClick={() => onSelectPen(pen.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      hasAlert ? 'bg-rose-500' : isSelected ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  />
                  <span className="truncate">{pen.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {hasAlert && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 24/7 Monitoring Status */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/80 rounded-2xl p-3.5 text-xs text-emerald-950">
        <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Giám Sát Tự Động 24/7</span>
        </div>
        <p className="text-[11px] text-emerald-800/90 leading-relaxed">
          {currentMode === 'livestock'
            ? 'Kiểm tra nhiệt độ, độ ẩm và khí chuồng liên tục mỗi 15 giây theo thời gian thực.'
            : 'Kiểm tra nhiệt độ, độ ẩm không khí và độ ẩm đất vườn liên tục mỗi 15 giây.'}
        </p>
      </div>
    </aside>
  );
}
