'use client';

import React from 'react';
import { Plus, AlertCircle, Thermometer, Droplets, PawPrint, Sprout } from 'lucide-react';

interface PenStory {
  id: string;
  name: string;
  type: string;
  temp?: number;
  hum?: number;
  hasAlert?: boolean;
}

interface StoriesBarProps {
  pens: PenStory[];
  currentPenId: string;
  onSelectPen: (penId: string) => void;
  onOpenAddPenModal: () => void;
}

export default function StoriesBar({
  pens,
  currentPenId,
  onSelectPen,
  onOpenAddPenModal,
}: StoriesBarProps) {
  return (
    <div className="w-full overflow-x-auto pb-1 no-scrollbar">
      <div className="flex gap-3 min-w-max">
        {/* Add Area Card */}
        <button
          type="button"
          onClick={onOpenAddPenModal}
          className="relative w-32 sm:w-36 h-40 rounded-2xl bg-white shadow-sm border border-dashed border-emerald-300 overflow-hidden cursor-pointer group hover:border-emerald-500 hover:shadow-md transition flex flex-col items-center justify-center gap-2 p-3 text-center shrink-0"
          title="Thêm khu vực chuồng trại hoặc vườn cây mới"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white flex items-center justify-center transition">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block whitespace-nowrap">
              Thêm Khu Vực
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 whitespace-nowrap">
              Chuồng / Vườn mới
            </span>
          </div>
        </button>

        {/* Area Quick-Switch Cards */}
        {pens.map((pen) => {
          const isSelected = pen.id === currentPenId;
          const hasAlert = pen.hasAlert;
          const isCultivation = pen.type === 'cultivation';
          const bgImage = isCultivation
            ? '/images/farm-greenhouse.jpg'
            : '/images/farm-livestock.jpg';

          return (
            <button
              type="button"
              key={pen.id}
              onClick={() => onSelectPen(pen.id)}
              className={`relative w-36 sm:w-40 h-40 rounded-2xl shadow-sm border overflow-hidden cursor-pointer group transition duration-200 select-none text-left shrink-0 ${
                hasAlert
                  ? 'ring-2 ring-rose-500 border-rose-400'
                  : isSelected
                  ? 'ring-2 ring-emerald-600 border-emerald-500 shadow-md'
                  : 'border-slate-200/90 hover:shadow-md'
              }`}
            >
              <img
                src={bgImage}
                alt={pen.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
              <div
                className={`absolute inset-0 ${
                  hasAlert
                    ? 'bg-gradient-to-t from-rose-950/90 via-rose-950/35 to-black/20'
                    : isSelected
                    ? 'bg-gradient-to-t from-emerald-950/90 via-slate-900/30 to-black/15'
                    : 'bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-black/10'
                }`}
              />

              {/* Top Icon & Status Badge */}
              <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-1">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm backdrop-blur-md ${
                    hasAlert
                      ? 'bg-rose-600 text-white'
                      : isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/90 text-slate-800'
                  }`}
                >
                  {isCultivation ? (
                    <Sprout className="w-4 h-4" />
                  ) : (
                    <PawPrint className="w-4 h-4" />
                  )}
                </div>

                {hasAlert ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-600/95 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Cảnh báo
                  </span>
                ) : isSelected ? (
                  <span className="text-[10px] font-bold text-emerald-950 bg-emerald-300/95 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    Đang xem
                  </span>
                ) : null}
              </div>

              {/* Bottom Metrics */}
              <div className="absolute inset-x-0 bottom-0 p-2.5 z-10">
                <p className="text-xs font-bold text-white truncate drop-shadow-sm">
                  {pen.name}
                </p>

                <div className="flex items-center gap-2.5 mt-1 text-[11px] font-medium text-slate-200 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-amber-300 shrink-0" />
                    {pen.temp !== undefined ? `${pen.temp}°C` : '--'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-sky-300 shrink-0" />
                    {pen.hum !== undefined ? `${pen.hum}%` : '--'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
