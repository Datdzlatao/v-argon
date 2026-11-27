'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Thermometer,
  Stethoscope,
  Video,
  ScanFace,
  BellRing,
  Smartphone,
  Monitor,
  TabletSmartphone,
  ShieldCheck,
  Sparkles,
  XCircle,
  Check,
  Compass,
  LogIn,
  ChevronDown,
} from 'lucide-react';
import SmartFarmScene3D from './SmartFarmScene3D';
import DeviceShowcase3D from './DeviceShowcase3D';

interface LandingIntroProps {
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  authError: string;
  handleAuth: (e: React.FormEvent) => void;
  onDemo: () => void;
}

function ScrollReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-7'
      } ${className}`}
    >
      {children}
    </div>
  );
}

const CORE_PROBLEMS = [
  {
    num: '01',
    icon: Thermometer,
    title: 'Biến động vi khí hậu & rủi ro chuồng trại',
    problem:
      'Nhiệt độ, độ ẩm và khí thải thay đổi đột ngột dễ gây sốc nhiệt, dịch bệnh cho vật nuôi và cây trồng nếu không phát hiện kịp thời.',
    solution:
      'Cảm biến IoT theo dõi 24/7 theo từng khu vực, tự động bật quạt, đèn sưởi hoặc phun sương ngay khi vượt ngưỡng.',
    badge: 'Giám sát & ứng phó tự động 24/7',
  },
  {
    num: '02',
    icon: Stethoscope,
    title: 'Phát hiện bệnh chậm, thiếu phác đồ chuẩn',
    problem:
      'Nông dân thường phải chờ chuyên gia hoặc tự đoán bệnh qua kinh nghiệm, dẫn đến xử lý muộn và lạm dụng thuốc.',
    solution:
      'Chụp hoặc dán ảnh cây trồng, vật nuôi để AI chẩn đoán bệnh tức thì kèm phác đồ xử lý từ kho tri thức nông nghiệp.',
    badge: 'AI Chẩn đoán ảnh + RAG chuyên sâu',
  },
  {
    num: '03',
    icon: Video,
    title: 'Khó kiểm soát thao tác chăm sóc ngoài thực địa',
    problem:
      'Quản lý từ xa khó biết nhân công đã cho ăn, tưới nước hay bón phân đúng giờ, đúng quy trình hay chưa.',
    solution:
      'Camera AI theo dõi luồng trực tiếp từng chuồng/vườn, tự động nhận diện và ghi nhận hành vi chăm sóc theo thời gian thực.',
    badge: 'Thị giác máy tính & Nhật ký hành vi',
  },
  {
    num: '04',
    icon: ScanFace,
    title: 'An toàn sinh học & điểm danh thủ công',
    problem:
      'Chấm công giấy dễ sai sót, đồng thời người ra vào khu nuôi trồng không mặc đồ bảo hộ làm tăng nguy cơ lây nhiễm chéo.',
    solution:
      'Điểm danh 2 bước bằng nhận diện khuôn mặt chống giả mạo kết hợp kiểm tra khẩu trang và trang phục bảo hộ lao động.',
    badge: 'Khuôn mặt Anti-Spoofing + Bảo hộ',
  },
  {
    num: '05',
    icon: BellRing,
    title: 'Dữ liệu rời rạc giữa kho, đàn nuôi & vườn trồng',
    problem:
      'Thông tin vật tư sắp hết, lịch tiêm phòng, thu hoạch và cảnh báo nằm rải rác, khiến người quản lý dễ bỏ sót việc quan trọng.',
    solution:
      'Bản tin trực tiếp (Newsfeed) sắp xếp cảnh báo theo mức độ ưu tiên kèm nút xử lý nhanh, đồng bộ tức thì trên mọi thiết bị.',
    badge: 'Bản tin điều hành tập trung',
  },
];

const COMPARISON_ROWS = [
  {
    aspect: 'Giám sát môi trường & thiết bị',
    others: 'Chỉ hiển thị số liệu hoặc gửi thông báo thụ động, người dùng vẫn phải tự ra chuồng bật/tắt.',
    ours: 'Theo dõi độc lập từng khu vực 24/7 và tự động bật quạt, đèn sưởi, phun sương ngay khi vượt ngưỡng.',
  },
  {
    aspect: 'Chẩn đoán bệnh & hỏi đáp kỹ thuật',
    others: 'Không có AI phân tích ảnh; nông dân phải tự tìm kiếm trên mạng hoặc chờ cán bộ kỹ thuật.',
    ours: 'Chụp/dán ảnh trực tiếp vào trợ lý AI (Gemini Multimodal + Pinecone RAG) để nhận phác đồ xử lý ngay.',
  },
  {
    aspect: 'Kiểm soát an toàn sinh học & nhân sự',
    others: 'Chấm công thẻ từ/vân tay hoặc ghi sổ; không kiểm tra được nhân viên có mặc đồ bảo hộ hay không.',
    ours: 'Điểm danh 2 bước: nhận diện khuôn mặt chống giả mạo (MiniFASNet) + kiểm tra khẩu trang & đồ bảo hộ.',
  },
  {
    aspect: 'Camera giám sát chuồng trại',
    others: 'Chỉ xem video thông thường hoặc lưu thẻ nhớ xem lại khi đã xảy ra sự cố.',
    ours: 'Phát luồng WebSocket độ trễ thấp kèm AI nhận diện hành vi (cho ăn, tưới nước, bón phân).',
  },
  {
    aspect: 'Trải nghiệm đa nền tảng',
    others: 'Giao diện web nhiều chữ, khó thao tác trên điện thoại của người nông dân.',
    ours: '100% tiếng Việt phổ thông, đồng bộ realtime giữa Web Dashboard, PWA iOS và Android Native.',
  },
];

const ROADMAP_GAPS = [
  {
    title: 'Truy xuất nguồn gốc mã QR chuẩn Thông tư 02/2024',
    desc: 'Đang mở rộng thêm cổng tạo tem QR công khai cho người tiêu dùng quét xem nhật ký mùa vụ.',
  },
  {
    title: 'Quản lý tài chính, chi phí & lợi nhuận theo lứa',
    desc: 'Bổ sung thống kê chi phí vật tư, nhân công và ước tính lợi nhuận đầu ra cho từng chuồng/vườn.',
  },
  {
    title: 'Kết nối phần cứng IoT diện rộng (LoRaWAN / MQTT)',
    desc: 'Mở rộng chuẩn kết nối cho các vùng trồng ngoài trời xa nguồn điện và Wi-Fi.',
  },
];

const PLATFORMS = [
  {
    icon: Monitor,
    name: 'Web Dashboard',
    desc: 'Bảng điều khiển toàn diện cho chủ trang trại: biểu đồ vi khí hậu, luồng camera, kho vật tư và trợ lý AI.',
  },
  {
    icon: Smartphone,
    name: 'PWA iOS (iPhone / iPad)',
    desc: 'Cài đặt trực tiếp ra màn hình chính Safari, 4 tab gọn nhẹ, nhận cảnh báo và thao tác nhanh ngay tại chuồng.',
  },
  {
    icon: TabletSmartphone,
    name: 'Android Native',
    desc: 'Ứng dụng Kotlin Jetpack Compose mượt mà cho nhân công và kỹ thuật viên thao tác thực địa mọi lúc.',
  },
];

export default function LandingIntro({
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  authError,
  handleAuth,
  onDemo,
}: LandingIntroProps) {
  const [view, setView] = useState<'intro' | 'login'>('intro');
  const storySectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (view !== 'intro') return;
    let rafId = 0;

    const updateScroll = () => {
      const el = storySectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalScrollable = Math.max(1, el.offsetHeight - window.innerHeight);
      const passed = Math.max(0, -rect.top);
      const progress = Math.max(0, Math.min(1, passed / totalScrollable));
      setScrollProgress(progress);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [view]);

  const openLoginScreen = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setView('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-farm-950 via-[#08331d] to-emerald-950 text-white flex flex-col justify-between p-4 sm:p-8">
        <div className="mx-auto w-full max-w-5xl flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView('intro')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2 text-xs sm:text-sm font-bold text-white transition cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang giới thiệu</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-farm-600 text-white">
              <Sprout className="h-4 w-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight hidden sm:inline">
              V-ARGON
            </span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl my-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Visual Summary */}
          <div className="lg:col-span-6 rounded-[28px] overflow-hidden border border-white/15 bg-black/25 relative flex flex-col justify-between p-7 sm:p-9">
            <img
              src="/images/farm-greenhouse.jpg"
              alt="Nhà màng thông minh"
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-farm-950 via-farm-950/75 to-farm-950/40" />

            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-200">
                <Sparkles className="h-3.5 w-3.5 text-farm-gold" />
                Cổng Điều Hành Trang Trại
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-snug">
                Đăng nhập để quản lý toàn bộ chuồng trại &amp; vườn trồng theo thời gian thực.
              </h1>
              <p className="text-sm text-emerald-100/80 leading-relaxed">
                Theo dõi cảm biến IoT, điều khiển thiết bị từ xa, xem camera AI hành vi và trao đổi
                trực tiếp với Trợ lý Nông nghiệp 24/7.
              </p>
            </div>

            <div className="relative z-10 mt-8 pt-5 border-t border-white/15 grid grid-cols-2 gap-3 text-xs text-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Giám sát IoT 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>AI Chẩn đoán bệnh</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Camera AI hành vi</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Điểm danh bảo hộ</span>
              </div>
            </div>
          </div>

          {/* Right Auth Form */}
          <div className="lg:col-span-6 rounded-[28px] bg-white text-farm-ink p-7 sm:p-9 shadow-2xl border border-farm-line flex flex-col justify-center">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="inline-block rounded-full bg-farm-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-farm-900">
                  {authMode === 'login' ? 'Đăng nhập hệ thống' : 'Tạo tài khoản mới'}
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight mt-2 text-slate-900">
                  {authMode === 'login' ? 'Chào mừng trở lại' : 'Đăng Ký Quản Lý'}
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-farm-100 text-farm-700 shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Email Người Quản Lý
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="quanly@nongtrai.vn"
                  className="w-full bg-slate-50 text-sm rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Mật Khẩu
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 text-sm rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>

              {authError && (
                <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl transition shadow-md cursor-pointer"
              >
                {authMode === 'login' ? 'Đăng Nhập Vào Giao Diện Chính' : 'Tạo Tài Khoản'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-emerald-800 font-bold hover:underline cursor-pointer"
              >
                {authMode === 'login'
                  ? 'Chưa có tài khoản? Đăng ký ngay'
                  : 'Đã có tài khoản? Đăng nhập'}
              </button>

              <button
                type="button"
                onClick={onDemo}
                className="text-emerald-700 font-extrabold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Vào dùng thử ngay</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-emerald-200/70">
          V-ARGON • Hệ Thống Quản Lý Chăn Nuôi &amp; Trồng Trọt AI
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-farm-ink font-sans selection:bg-farm-100 selection:text-farm-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-emerald-900/10 bg-white/90 backdrop-blur-md text-slate-900">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-6 py-3.5 gap-3">
          <a href="#top" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition group-hover:scale-105">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight leading-none whitespace-nowrap text-slate-900">
                V-ARGON
              </span>
              <span className="block text-[11px] text-emerald-700 font-semibold mt-0.5 whitespace-nowrap">
                AI &amp; IoT Quản lý toàn diện
              </span>
            </div>
          </a>

          <nav
            className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600"
            aria-label="Điều hướng chính"
          >
            <a href="#van-de" className="hover:text-emerald-700 transition whitespace-nowrap">
              Vấn đề giải quyết
            </a>
            <a href="#so-sanh" className="hover:text-emerald-700 transition whitespace-nowrap">
              So sánh &amp; Lộ trình
            </a>
            <a href="#he-sinh-thai" className="hover:text-emerald-700 transition whitespace-nowrap">
              Hệ sinh thái
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openLoginScreen('login')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-900 transition cursor-pointer whitespace-nowrap"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng Nhập</span>
            </button>

            <button
              type="button"
              onClick={onDemo}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <span>Trải nghiệm thử</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Grand Full-Screen 3D Opening (Long Sky-to-Farmer Close-Up Descent) */}
      <section
        id="top"
        ref={storySectionRef}
        className="relative h-[520vh] bg-sky-200"
      >
        <div className="sticky top-16 h-[calc(100vh-4rem)] w-full overflow-hidden">
          <SmartFarmScene3D scrollProgress={scrollProgress} />

          {/* Opening Title (fades gently as you dive into the 3D scene so the view is unobstructed) */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-emerald-950/70 via-emerald-950/20 to-transparent pt-24 pb-8 sm:pb-12 px-5 transition-opacity duration-300"
            style={{ opacity: Math.max(0, 1 - scrollProgress * 3.2) }}
          >
            <div className="mx-auto max-w-4xl text-center text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 text-emerald-900 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider shadow-sm mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>V-ARGON • AI &amp; IoT Nông Nghiệp</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight drop-shadow-md">
                Cánh đồng xanh thông minh,{' '}
                <span className="italic text-amber-200">vận hành chủ động 24/7.</span>
              </h1>

              <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openLoginScreen('login')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-7 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng Nhập Hệ Thống</span>
                </button>

                <button
                  type="button"
                  onClick={onDemo}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/95 hover:bg-white px-6 py-3.5 text-sm sm:text-base font-extrabold text-emerald-950 shadow-xl transition hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Trải Nghiệm Ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-white/90">
                <ChevronDown className="h-4 w-4 animate-bounce" />
                <span>Cuộn xuống để bay từ bầu trời xuống tận ngôi nhà</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Interactive 3D Laptop + Phone UI Preview */}
      <section id="xem-truoc-3d" className="bg-white border-b border-farm-line py-16 lg:py-24">
        <div className="mx-auto max-w-[1180px] px-5">
          <ScrollReveal>
            <div className="max-w-[820px] mb-8">
              <span className="inline-block mb-3 rounded-full bg-farm-100 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-farm-900">
                Xem trước giao diện thực tế
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-farm-ink leading-tight">
                Một nguồn dữ liệu — hiển thị trực quan trên{' '}
                <span className="text-farm-700">Laptop &amp; Điện thoại 3D.</span>
              </h2>
              <p className="mt-3 text-base text-farm-muted leading-relaxed">
                Chọn từng phân hệ bên dưới và kéo trực tiếp trên mô hình 3D để xem cách bảng điều
                khiển Web và ứng dụng PWA iOS phối hợp theo thời gian thực.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <DeviceShowcase3D />
          </ScrollReveal>
        </div>
      </section>

      {/* Section: 5 Core Problems & Solutions (Scroll Reveal) */}
      <section id="van-de" className="bg-farm-50 border-b border-farm-line py-16 lg:py-24">
        <div className="mx-auto max-w-[1180px] px-5">
          <ScrollReveal>
            <div className="max-w-[820px] mb-10 lg:mb-12">
              <span className="inline-block mb-3 rounded-full bg-farm-100 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-farm-900">
                Những vấn đề cốt lõi chúng tôi giải quyết
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-farm-ink leading-tight">
                Năm nút thắt khiến trang trại truyền thống{' '}
                <em className="not-italic text-farm-700">khó kiểm soát và dễ mất mùa.</em>
              </h2>
              <p className="mt-3 text-base sm:text-lg text-farm-muted leading-relaxed">
                Cuộn xuống để xem từng vấn đề thực tế ngoài chuồng trại, vườn trồng và cách hệ thống
                xử lý tự động.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {CORE_PROBLEMS.map((item, idx) => {
              const Icon = item.icon;
              const isLastOdd = idx === CORE_PROBLEMS.length - 1 && CORE_PROBLEMS.length % 2 === 1;
              return (
                <ScrollReveal
                  key={item.num}
                  delay={idx * 80}
                  className={isLastOdd ? 'md:col-span-2' : ''}
                >
                  <article className="h-full flex flex-col items-start gap-3.5 rounded-[20px] border border-farm-line bg-white p-6 sm:p-7 transition hover:shadow-[0_18px_55px_rgba(9,62,32,0.08)]">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-extrabold tracking-wider text-farm-gold">
                        {item.num}
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-farm-100 text-farm-800">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <h3 className="text-xl font-extrabold tracking-tight text-farm-ink leading-snug">
                      {item.title}
                    </h3>

                    <div className="space-y-2 text-sm sm:text-[15px] leading-relaxed">
                      <p className="text-farm-muted">
                        <strong className="text-farm-ink font-semibold">Vấn đề: </strong>
                        {item.problem}
                      </p>
                      <p className="text-farm-900">
                        <strong className="text-farm-700 font-bold">Giải pháp: </strong>
                        {item.solution}
                      </p>
                    </div>

                    <div className="mt-auto pt-2 flex w-full flex-wrap items-center justify-between gap-3">
                      <span className="rounded-[10px] bg-farm-100 px-3 py-1.5 text-xs font-bold text-farm-900">
                        {item.badge}
                      </span>
                      <button
                        type="button"
                        onClick={onDemo}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-farm-700 hover:text-farm-900 transition cursor-pointer"
                      >
                        <span>Xem trong bản thử</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section: Comparison & Honest Gaps */}
      <section id="so-sanh" className="bg-white border-b border-farm-line py-16 lg:py-24">
        <div className="mx-auto max-w-[1180px] px-5 space-y-12">
          <ScrollReveal>
            <div className="max-w-[820px]">
              <span className="inline-block mb-3 rounded-full bg-farm-100 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-farm-900">
                So sánh thực tế
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-farm-ink leading-tight">
                Khác biệt so với phần mềm nông trại thông thường &amp;{' '}
                <span className="text-farm-700">những điểm đang tiếp tục hoàn thiện.</span>
              </h2>
            </div>
          </ScrollReveal>

          {/* Comparison Cards */}
          <div className="space-y-4">
            {COMPARISON_ROWS.map((row, idx) => (
              <ScrollReveal key={row.aspect} delay={idx * 70}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-[20px] border border-farm-line bg-farm-50/50 p-5 sm:p-6 items-center">
                  <div className="lg:col-span-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-farm-gold">
                      Tiêu chí 0{idx + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-farm-ink mt-1">
                      {row.aspect}
                    </h3>
                  </div>

                  <div className="lg:col-span-4 rounded-xl bg-white border border-red-100 p-4 flex items-start gap-2.5">
                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase text-red-600 mb-1">
                        Hệ thống khác
                      </span>
                      <p className="text-xs sm:text-sm text-farm-muted leading-relaxed">
                        {row.others}
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-xl bg-emerald-50/90 border border-emerald-200 p-4 flex items-start gap-2.5">
                    <Check className="h-5 w-5 text-farm-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase text-farm-800 mb-1">
                        V-ARGON giải quyết
                      </span>
                      <p className="text-xs sm:text-sm text-farm-950 font-medium leading-relaxed">
                        {row.ours}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Honest Gaps / Roadmap */}
          <ScrollReveal delay={100}>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/60 p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-farm-ink">
                    Những điểm còn thiếu &amp; hướng mở rộng tiếp theo
                  </h3>
                  <p className="text-xs sm:text-sm text-farm-muted">
                    Nhìn thẳng vào các phần hệ thống hiện tại chưa có để tiếp tục nâng cấp:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ROADMAP_GAPS.map((gap) => (
                  <div
                    key={gap.title}
                    className="rounded-2xl bg-white border border-amber-200/80 p-4 space-y-1.5"
                  >
                    <h4 className="text-sm font-extrabold text-farm-ink">{gap.title}</h4>
                    <p className="text-xs sm:text-sm text-farm-muted leading-relaxed">{gap.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section: Multi-Platform Ecosystem */}
      <section id="he-sinh-thai" className="bg-farm-50 py-16 lg:py-20 border-b border-farm-line">
        <div className="mx-auto max-w-[1180px] px-5">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div className="max-w-2xl">
                <span className="inline-block mb-3 rounded-full bg-farm-100 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-farm-900">
                  Đồng bộ đa nền tảng
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-farm-ink">
                  Một nguồn dữ liệu — vận hành mượt trên{' '}
                  <span className="text-farm-700">Web, iOS và Android.</span>
                </h2>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openLoginScreen('login')}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-farm-900 hover:bg-farm-950 px-5 py-3 text-sm font-extrabold text-white transition cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng Nhập Hệ Thống</span>
                </button>
                <button
                  type="button"
                  onClick={onDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-farm-line bg-white hover:bg-farm-100 px-5 py-3 text-sm font-extrabold text-farm-900 transition cursor-pointer whitespace-nowrap"
                >
                  <span>Dùng Thử</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLATFORMS.map((p, idx) => {
              const Icon = p.icon;
              return (
                <ScrollReveal key={p.name} delay={idx * 90}>
                  <div className="h-full rounded-[20px] border border-farm-line bg-white p-6 flex flex-col gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-farm-50 border border-farm-line text-farm-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-extrabold text-farm-ink">{p.name}</h3>
                    <p className="text-sm text-farm-muted leading-relaxed">{p.desc}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-farm-950 text-emerald-100/80 py-10">
        <div className="mx-auto max-w-[1180px] px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-white font-bold">
            <Sprout className="h-5 w-5 text-farm-600" />
            <span>V-ARGON • Quản Lý Chăn Nuôi &amp; Trồng Trọt AI</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#top" className="hover:text-white transition">
              Lên đầu trang
            </a>
            <button
              type="button"
              onClick={onDemo}
              className="font-bold text-emerald-300 hover:text-white transition cursor-pointer"
            >
              Trải nghiệm ngay →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
