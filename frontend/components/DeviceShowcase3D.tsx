'use client';

import React, { useRef, useState } from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  Fan,
  Video,
  ScanFace,
  Stethoscope,
  Sparkles,
  RotateCcw,
  Move,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type PreviewTab = 'iot' | 'vision' | 'diagnose';

const PREVIEW_TABS: Array<{ id: PreviewTab; label: string; desc: string }> = [
  {
    id: 'iot',
    label: 'Vi khí hậu & IoT',
    desc: 'Theo dõi nhiệt độ, độ ẩm, mùi hôi và tự động bật thiết bị ứng phó 24/7.',
  },
  {
    id: 'vision',
    label: 'Camera AI & Bảo hộ',
    desc: 'Nhận diện hành vi cho ăn/tưới nước và kiểm tra khuôn mặt + đồ bảo hộ.',
  },
  {
    id: 'diagnose',
    label: 'AI Chẩn đoán bệnh',
    desc: 'Chụp hoặc dán ảnh cây trồng/vật nuôi để nhận phác đồ xử lý tức thì.',
  },
];

export default function DeviceShowcase3D() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('iot');
  const [rot, setRot] = useState({ x: 8, y: -12 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setRot((prev) => ({
      x: Math.max(-18, Math.min(22, prev.x - dy * 0.25)),
      y: Math.max(-32, Math.min(32, prev.y + dx * 0.3)),
    }));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher + Drag Hint */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-farm-100/80 p-1.5 border border-farm-line">
          {PREVIEW_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  active
                    ? 'bg-farm-800 text-white shadow-sm'
                    : 'text-farm-900 hover:bg-white/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-farm-muted font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-farm-50 border border-farm-line px-3 py-1.5">
            <Move className="h-3.5 w-3.5 text-farm-700" />
            Kéo để xoay Laptop &amp; Điện thoại 3D
          </span>
          <button
            type="button"
            onClick={() => setRot({ x: 8, y: -12 })}
            className="inline-flex items-center gap-1 rounded-full border border-farm-line bg-white px-2.5 py-1.5 hover:bg-farm-50 text-farm-ink transition cursor-pointer"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* Active Tab Description */}
      <p className="text-sm text-farm-muted">
        {PREVIEW_TABS.find((t) => t.id === activeTab)?.desc}
      </p>

      {/* 3D Interactive Stage */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative select-none cursor-grab active:cursor-grabbing rounded-[28px] border border-farm-line bg-gradient-to-br from-farm-950 via-farm-900 to-emerald-950 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-[0_24px_70px_rgba(7,59,33,0.22)]"
        style={{ perspective: '1400px', touchAction: 'none' }}
      >
        {/* Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-farm-600/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
        />

        {/* 3D Rotatable Assembly */}
        <div
          className="relative mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-6 transition-transform duration-150 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          }}
        >
          {/* 3D LAPTOP MOCKUP (Web Dashboard) */}
          <div
            className="w-full max-w-[600px]"
            style={{ transform: 'translateZ(20px)' }}
          >
            {/* Laptop Lid / Screen */}
            <div className="rounded-t-2xl border-[6px] border-[#1c2822] bg-[#0f1914] p-2.5 shadow-2xl">
              {/* Top Camera Dot */}
              <div className="mx-auto mb-2 flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                <span className="text-[10px] text-emerald-200/60 font-medium">
                  Web Dashboard • V-ARGON
                </span>
              </div>

              {/* Screen Content */}
              <div className="rounded-lg bg-[#F0F2F5] text-farm-ink p-3 sm:p-4 min-h-[250px] flex flex-col gap-3">
                {/* Mini Top Bar */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-farm-600" />
                    <span className="text-xs font-extrabold text-farm-950">
                      Khu A — Chuồng Heo Công Nghệ Cao
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ● Trực tuyến 24/7
                  </span>
                </div>

                {activeTab === 'iot' && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-white p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                        <Thermometer className="h-3.5 w-3.5 text-orange-500" /> Nhiệt độ
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-gray-900">27.4°C</div>
                      <span className="text-[10px] text-emerald-600 font-semibold">Ngưỡng an toàn</span>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                        <Droplets className="h-3.5 w-3.5 text-blue-500" /> Độ ẩm
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-gray-900">68%</div>
                      <span className="text-[10px] text-emerald-600 font-semibold">Ổn định</span>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                        <Wind className="h-3.5 w-3.5 text-amber-500" /> Mùi hôi
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-gray-900">115 ppm</div>
                      <span className="text-[10px] text-amber-600 font-semibold">Quạt đang chạy</span>
                    </div>
                    <div className="col-span-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <Fan className="h-4 w-4 text-emerald-600 animate-spin" />
                        <span>Tự động hóa: Đã bật Quạt thông gió Khu A (từ watcher.py)</span>
                      </div>
                      <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
                        ĐANG BẬT
                      </span>
                    </div>
                  </div>
                )}

                {activeTab === 'vision' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[#0b1510] text-white p-3 flex flex-col justify-between min-h-[155px]">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                          <Video className="h-3 w-3" /> IP CAM KHU A
                        </span>
                        <span className="rounded bg-red-500/90 px-1.5 py-0.5 font-bold">LIVE</span>
                      </div>
                      <div className="my-2 rounded-lg border border-emerald-500/30 bg-emerald-950/60 p-2 text-[11px]">
                        <div className="font-bold text-emerald-300">🍲 Phát hiện: Cho vật nuôi ăn</div>
                        <div className="text-emerald-100/70 text-[10px] mt-0.5">
                          MediaPipe Pose + Gemini Vision xác thực
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-gray-100 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
                        <ScanFace className="h-4 w-4 text-farm-700" />
                        <span>Điểm danh 2 bước</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] my-2">
                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1.5">
                          <span className="font-semibold text-gray-700">Khuôn mặt (Anti-spoof)</span>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1.5">
                          <span className="font-semibold text-gray-700">Đồ bảo hộ &amp; Khẩu trang</span>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">
                        ✓ Hợp lệ vào ca — Nguyễn Văn An
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'diagnose' && (
                  <div className="grid grid-cols-12 gap-2.5">
                    <div className="col-span-5 rounded-xl bg-emerald-950 text-white p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-emerald-300">ẢNH MẪU GỬI LÊN</span>
                      <div className="my-2 rounded-lg bg-emerald-900/70 border border-emerald-500/30 p-3 text-center">
                        <Stethoscope className="h-7 w-7 mx-auto text-emerald-300 mb-1" />
                        <span className="text-[10px] text-emerald-100">Lá sầu riêng đốm vàng</span>
                      </div>
                      <span className="text-[10px] text-emerald-200/70">Pinecone RAG + Gemini</span>
                    </div>
                    <div className="col-span-7 rounded-xl bg-white p-3 border border-gray-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-farm-800">
                        <Sparkles className="h-3.5 w-3.5 text-farm-gold" />
                        <span>Phác đồ xử lý đề xuất</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        <strong>Nhận định:</strong> Nghi ngờ nấm thán thư giai đoạn đầu.
                      </p>
                      <p className="text-[11px] text-gray-700 leading-relaxed">
                        <strong>Xử lý:</strong> Cắt tỉa lá bệnh, giữ độ ẩm dưới 75%, phun chế phẩm sinh học theo liều khuyến nghị.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Laptop Base */}
            <div className="mx-auto h-3 w-[104%] -ml-[2%] rounded-b-xl bg-gradient-to-b from-[#394640] to-[#1e2924] shadow-lg" />
          </div>

          {/* 3D PHONE MOCKUP (PWA iOS) */}
          <div
            className="w-[225px] shrink-0 lg:-ml-10 lg:mt-10"
            style={{ transform: 'translateZ(65px)' }}
          >
            <div className="rounded-[34px] border-[5px] border-[#1f2c25] bg-[#0e1713] p-2 shadow-[0_25px_60px_rgba(0,0,0,0.55)]">
              {/* Dynamic Island */}
              <div className="mx-auto mb-2 h-3.5 w-20 rounded-full bg-black" />
              <div className="rounded-[24px] bg-[#F2F2F7] text-farm-ink p-3 min-h-[300px] flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-farm-950">V-ARGON iOS</span>
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      PWA
                    </span>
                  </div>

                  {activeTab === 'iot' && (
                    <>
                      <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                        <div className="text-[10px] font-bold text-gray-400">BẢN TIN TRỰC TIẾP</div>
                        <div className="mt-1 flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>Khu A mùi hôi tăng nhẹ (115 ppm)</span>
                        </div>
                        <div className="mt-2 rounded-lg bg-farm-700 py-1 text-center text-[10px] font-bold text-white">
                          Đã tự bật quạt thông gió
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white p-2 text-center shadow-sm">
                          <div className="text-[9px] text-gray-500">Nhiệt độ</div>
                          <div className="text-sm font-extrabold text-farm-800">27.4°C</div>
                        </div>
                        <div className="rounded-xl bg-white p-2 text-center shadow-sm">
                          <div className="text-[9px] text-gray-500">Độ ẩm</div>
                          <div className="text-sm font-extrabold text-blue-600">68%</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'vision' && (
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm space-y-2">
                      <div className="text-[10px] font-bold text-gray-400">CAMERA &amp; RA VÀO</div>
                      <div className="rounded-xl bg-farm-950 p-2.5 text-white text-[10px]">
                        <div className="font-bold text-emerald-300">● Luồng WebSocket mượt</div>
                        <div className="text-white/75 mt-1">Đang ghi nhận: Cho ăn</div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-2 text-[10px] font-bold text-emerald-800">
                        ✓ Đủ đồ bảo hộ lao động
                      </div>
                    </div>
                  )}

                  {activeTab === 'diagnose' && (
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm space-y-2">
                      <div className="text-[10px] font-bold text-gray-400">TRỢ LÝ AI 24/7</div>
                      <div className="rounded-xl bg-farm-50 p-2 text-[10px] text-farm-900">
                        &ldquo;Lá cây bị đốm vàng phải xử lý sao?&rdquo;
                      </div>
                      <div className="rounded-xl bg-farm-700 p-2 text-[10px] text-white">
                        AI: Đã đối chiếu RAG — khuyến nghị giảm ẩm và tỉa lá bệnh.
                      </div>
                    </div>
                  )}
                </div>

                {/* iOS Bottom Tab Bar */}
                <div className="mt-3 flex items-center justify-around border-t border-gray-200 pt-2 text-[9px] font-bold text-gray-500">
                  <span className="text-farm-700">Trang chủ</span>
                  <span>Máy quay</span>
                  <span>Ra vào</span>
                  <span>Trợ lý</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
