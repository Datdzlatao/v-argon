'use client';

import React, { useEffect, useState } from 'react';
import {
  ScanFace,
  Power,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  History,
  Users,
  LogIn,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import WebSocketStreamPlayer from './WebSocketStreamPlayer';
import {
  getFaceVideoWsUrl,
  getStaffList,
  getStaffAttendanceHistory,
  checkInStaff,
  enrollStaffFace,
} from '../lib/api';

interface IosAttendanceTabProps {
  currentPenId: string;
  isFaceCamOn: boolean;
  onToggleFaceCam: () => void;
  faceTelemetry: any;
  onNotify?: (msg: string) => void;
}

export default function IosAttendanceTab({
  currentPenId,
  isFaceCamOn,
  onToggleFaceCam,
  faceTelemetry,
  onNotify,
}: IosAttendanceTabProps) {
  const [subView, setSubView] = useState<'camera' | 'history' | 'staff'>('camera');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'check_in' | 'check_out'>('all');

  // Manual Check-in
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const [checkNote, setCheckNote] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  // Face Enroll Modal
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollId, setEnrollId] = useState('');
  const [enrollName, setEnrollName] = useState('');
  const [enrollRole, setEnrollRole] = useState('Kỹ thuật viên');
  const [fileThang, setFileThang] = useState<File | null>(null);
  const [fileTrai, setFileTrai] = useState<File | null>(null);
  const [filePhai, setFilePhai] = useState<File | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollErr, setEnrollErr] = useState('');

  const loadData = async () => {
    const [st, hist] = await Promise.all([getStaffList(), getStaffAttendanceHistory(30)]);
    setStaffList(st);
    setHistory(hist);
    if (st.length > 0 && !selectedStaffId) {
      setSelectedStaffId(st[0].id);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) return;
    setCheckingIn(true);
    try {
      await checkInStaff({
        staffId: staff.id,
        staffName: staff.name,
        penId: currentPenId || '123',
        checkType,
        note: checkNote.trim() || undefined,
      });
      setCheckNote('');
      onNotify?.(`Đã ghi nhận ${checkType === 'check_in' ? 'Vào ca' : 'Tan ca'} cho ${staff.name}`);
      await loadData();
    } catch {
      onNotify?.('Lỗi khi chấm công thủ công');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollErr('');
    if (!enrollId.trim() || !enrollName.trim() || !fileThang) {
      setEnrollErr('Vui lòng nhập Mã NV, Họ tên và chọn ít nhất ảnh nhìn thẳng.');
      return;
    }
    setEnrolling(true);
    try {
      await enrollStaffFace({
        staffId: enrollId,
        staffName: enrollName,
        role: enrollRole,
        penId: currentPenId || '123',
        fileThang,
        fileTrai,
        filePhai,
      });
      setShowEnroll(false);
      setEnrollId('');
      setEnrollName('');
      setFileThang(null);
      setFileTrai(null);
      setFilePhai(null);
      onNotify?.(`Đã đăng ký khuôn mặt cho ${enrollName}`);
      await loadData();
    } catch (err: any) {
      setEnrollErr(err?.message || 'Đăng ký khuôn mặt thất bại.');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredHistory = history.filter(
    (h) => filterType === 'all' || h.check_type === filterType
  );

  return (
    <div className="space-y-3">
      {/* Sub-navigation + Enroll Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-black/[0.06] p-1 rounded-xl grid grid-cols-3 gap-1">
          {[
            { id: 'camera', label: 'Camera AI', icon: ScanFace },
            { id: 'history', label: 'Lịch sử', icon: History },
            { id: 'staff', label: 'Nhân sự', icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubView(t.id as any)}
                className={`py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 transition ${
                  subView === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowEnroll(true)}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold flex items-center gap-1 shrink-0 shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Đăng ký mặt
        </button>
      </div>

      {subView === 'camera' && (
        <>
          {isFaceCamOn ? (
            <WebSocketStreamPlayer
              wsUrl={getFaceVideoWsUrl(true)}
              isActive={isFaceCamOn}
              label="Quét mặt & Bảo hộ (WSS)"
            />
          ) : (
            <div className="bg-black rounded-2xl aspect-video flex flex-col items-center justify-center text-white p-6 text-center">
              <ScanFace className="w-10 h-10 text-white/40 mb-2" />
              <p className="text-[15px] font-semibold">Camera điểm danh đang tắt</p>
              <p className="text-[12px] text-white/60 mt-1">
                Đứng đủ toàn thân trước camera để kiểm tra bảo hộ
              </p>
            </div>
          )}

          <button
            onClick={onToggleFaceCam}
            className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition ${
              isFaceCamOn ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            {isFaceCamOn ? 'Tắt Camera Điểm Danh' : 'Bật Camera Điểm Danh'}
          </button>

          {faceTelemetry && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-500">Trạng thái bảo hộ</span>
                <span
                  className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-0.5 rounded-full ${
                    faceTelemetry.uniform?.is_correct
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {faceTelemetry.uniform?.is_correct ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {faceTelemetry.uniform?.status || 'Đang quét'}
                </span>
              </div>
              {faceTelemetry.uniform?.message && (
                <p className="text-[13px] text-slate-700 leading-snug">
                  {faceTelemetry.uniform.message}
                </p>
              )}
              {Array.isArray(faceTelemetry.faces) && faceTelemetry.faces.length > 0 && (
                <div className="pt-2 border-t border-black/5 text-[13px]">
                  <span className="text-slate-500">Nhân viên: </span>
                  <strong className="text-slate-900">
                    {faceTelemetry.faces[0].name || 'Người lạ'}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Manual Check-in Form */}
          <form onSubmit={handleManualCheckIn} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-800">Chấm công thủ công</h3>
              <button type="button" onClick={loadData} className="text-slate-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.name}
                  </option>
                ))}
              </select>
              <select
                value={checkType}
                onChange={(e) => setCheckType(e.target.value as any)}
                className="bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
              >
                <option value="check_in">Vào ca (Check-in)</option>
                <option value="check_out">Tan ca (Check-out)</option>
              </select>
            </div>
            <input
              value={checkNote}
              onChange={(e) => setCheckNote(e.target.value)}
              placeholder="Ghi chú (tùy chọn)..."
              className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="submit"
              disabled={checkingIn || !selectedStaffId}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {checkType === 'check_in' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              {checkingIn ? 'Đang lưu...' : checkType === 'check_in' ? 'Ghi Nhận Vào Ca' : 'Ghi Nhận Tan Ca'}
            </button>
          </form>
        </>
      )}

      {subView === 'history' && (
        <div className="space-y-2.5">
          <div className="flex gap-1.5">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'check_in', label: 'Vào ca' },
              { id: 'check_out', label: 'Tan ca' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                  filterType === f.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-[13px] text-slate-400">
                Chưa có lịch sử ra vào.
              </div>
            ) : (
              filteredHistory.map((item, idx) => (
                <div key={item.id || idx} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-slate-900 truncate">
                      {item.staff_name || item.staff_id}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Khu {item.pen_id || '---'} • {item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : ''}
                    </p>
                    {item.note && <p className="text-[11px] text-slate-600 mt-0.5">{item.note}</p>}
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      item.check_type === 'check_out'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.check_type === 'check_out' ? 'Tan ca' : 'Vào ca'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subView === 'staff' && (
        <div className="space-y-2">
          {staffList.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-[13px] text-slate-400">
              Chưa có danh sách nhân sự.
            </div>
          ) : (
            staffList.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">
                    {s.name} <span className="text-[11px] text-emerald-700 font-semibold">({s.id})</span>
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {s.role || 'Nhân viên'} • Khu {s.pen_id || '---'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Face Enrollment Modal */}
      {showEnroll && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-slate-900">Đăng ký khuôn mặt (eKYC)</h3>
              <button onClick={() => setShowEnroll(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEnroll} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={enrollId}
                  onChange={(e) => setEnrollId(e.target.value)}
                  placeholder="Mã NV (VD: NV05)"
                  className="bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
                />
                <input
                  value={enrollRole}
                  onChange={(e) => setEnrollRole(e.target.value)}
                  placeholder="Chức vụ"
                  className="bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
                />
              </div>
              <input
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder="Họ và tên nhân viên"
                className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
              />
              <div className="space-y-1.5 text-[12px]">
                <label className="block font-semibold text-slate-700">1. Ảnh nhìn thẳng (bắt buộc):</label>
                <input type="file" accept="image/*" onChange={(e) => setFileThang(e.target.files?.[0] || null)} className="w-full text-[12px]" />
                <label className="block font-semibold text-slate-700">2. Ảnh nghiêng trái (khuyên dùng):</label>
                <input type="file" accept="image/*" onChange={(e) => setFileTrai(e.target.files?.[0] || null)} className="w-full text-[12px]" />
                <label className="block font-semibold text-slate-700">3. Ảnh nghiêng phải (khuyên dùng):</label>
                <input type="file" accept="image/*" onChange={(e) => setFilePhai(e.target.files?.[0] || null)} className="w-full text-[12px]" />
              </div>
              {enrollErr && <p className="text-[12px] text-rose-600">{enrollErr}</p>}
              <button
                type="submit"
                disabled={enrolling}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px] disabled:opacity-50"
              >
                {enrolling ? 'Đang trích xuất khuôn mặt...' : 'Lưu Hồ Sơ Khuôn Mặt'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
