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
  const [subView, setSubView] = useState<'history' | 'staff'>('history');
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
    if (!enrollName.trim() || !fileThang) {
      setEnrollErr('Vui lòng nhập Họ tên và chọn ít nhất ảnh nhìn thẳng.');
      return;
    }
    setEnrolling(true);
    try {
      await enrollStaffFace({
        staffName: enrollName,
        role: enrollRole,
        penId: currentPenId || '123',
        fileThang,
        fileTrai,
        filePhai,
      });
      setShowEnroll(false);
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
        <div className="flex-1 bg-black/[0.06] p-1 rounded-xl grid grid-cols-2 gap-1">
          {[
            { id: 'history', label: 'Lịch sử ra vào', icon: History },
            { id: 'staff', label: 'Danh sách nhân sự', icon: Users },
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
        <div className="space-y-2.5">
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-slate-900">Danh sách nhân sự ({staffList.length})</p>
              <p className="text-[11px] text-slate-500">ID tự động tăng trong Database khi thêm mới</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEnroll(true)}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold inline-flex items-center gap-1 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Thêm mới
            </button>
          </div>
          {staffList.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-[13px] text-slate-400">
              Chưa có danh sách nhân sự.
            </div>
          ) : (
            staffList.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">
                    {s.name} <span className="text-[11px] text-emerald-700 font-semibold">(ID: {s.id})</span>
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
              <h3 className="text-[16px] font-bold text-slate-900">Thêm khuôn mặt nhân sự mới</h3>
              <button onClick={() => setShowEnroll(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-xl px-3 py-1.5 font-medium">
              ID nhân viên sẽ tự động tăng trong database.
            </p>
            <form onSubmit={handleEnroll} className="space-y-2.5">
              <input
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder="Họ và tên nhân viên"
                className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none"
              />
              <input
                value={enrollRole}
                onChange={(e) => setEnrollRole(e.target.value)}
                placeholder="Chức vụ (VD: Kỹ thuật viên)"
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
