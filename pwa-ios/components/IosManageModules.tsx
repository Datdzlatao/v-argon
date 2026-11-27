'use client';

import React, { useEffect, useState } from 'react';
import {
  Wallet,
  Table2,
  Users,
  QrCode,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  Sprout,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import IosFarmOperations from './IosFarmOperations';

type SubTab = 'farm' | 'finance' | 'office' | 'hr' | 'qr';

interface FinanceItem {
  id: string;
  type: 'thu' | 'chi';
  title: string;
  amount: number;
  date: string;
}

interface LeaveItem {
  id: string;
  staff: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface QuotaItem {
  id: string;
  staff_name: string;
  task_name: string;
  target: number;
  completed: number;
  unit: string;
}

interface QrItem {
  id: string;
  product: string;
  lot: string;
  url: string;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IosManageModules({
  penId = '',
  penName,
  penType = 'livestock',
  pens = [],
  onRefreshParent,
}: {
  penId?: string;
  penName: string;
  penType?: string;
  pens?: Array<{ id: string; name: string; type?: string }>;
  onRefreshParent?: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>('farm');

  // Finance
  const [finances, setFinances] = useState<FinanceItem[]>([]);
  const [finType, setFinType] = useState<'thu' | 'chi'>('thu');
  const [finTitle, setFinTitle] = useState('');
  const [finAmount, setFinAmount] = useState('');

  // Office
  const [officeRows, setOfficeRows] = useState<any[]>([]);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeTitle, setOfficeTitle] = useState('');
  const [officeCategory, setOfficeCategory] = useState('Nhật ký');
  const [officeSummary, setOfficeSummary] = useState('');

  // HR: Leaves, Quotas, Staff Wages
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [leaveStaff, setLeaveStaff] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [quotaStaff, setQuotaStaff] = useState('');
  const [quotaTask, setQuotaTask] = useState('');
  const [quotaTarget, setQuotaTarget] = useState('');

  // QR Video
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [qrProduct, setQrProduct] = useState('');
  const [qrLot, setQrLot] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  const loadOffice = async () => {
    setOfficeLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/office/records?limit=20`);
      if (res.ok) {
        const json = await res.json();
        setOfficeRows(json.records || json.data || []);
      }
    } catch {
      // ignore offline
    } finally {
      setOfficeLoading(false);
    }
  };

  const loadSupabaseModules = async () => {
    try {
      const [finRes, leaveRes, quotaRes, qrRes, staffRes] = await Promise.all([
        supabase.from('farm_finances').select('*').order('id', { ascending: false }).limit(30),
        supabase.from('farm_hr_leaves').select('*').order('id', { ascending: false }).limit(20),
        supabase.from('farm_hr_quotas').select('*').order('id', { ascending: false }).limit(20),
        supabase.from('farm_video_qrs').select('*').order('id', { ascending: false }).limit(20),
        fetch(`${backendUrl}/api/staff`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      if (finRes.data) {
        setFinances(
          finRes.data.map((f: any) => ({
            id: String(f.id),
            type: f.type === 'chi' ? 'chi' : 'thu',
            title: f.title || '',
            amount: Number(f.amount || 0),
            date: f.record_date || new Date().toISOString().slice(0, 10),
          }))
        );
      }
      if (leaveRes.data) {
        setLeaves(
          leaveRes.data.map((l: any) => ({
            id: String(l.id),
            staff: l.staff_name || '',
            reason: l.reason || '',
            status: l.status || 'pending',
          }))
        );
      }
      if (quotaRes.data) {
        setQuotas(
          quotaRes.data.map((q: any) => ({
            id: String(q.id),
            staff_name: q.staff_name || '',
            task_name: q.task_name || '',
            target: Number(q.target || 0),
            completed: Number(q.completed || 0),
            unit: q.unit || 'kg',
          }))
        );
      }
      if (qrRes.data) {
        setQrs(
          qrRes.data.map((q: any) => ({
            id: String(q.id),
            product: q.product_name || '',
            lot: q.lot_code || '',
            url: q.video_url || '',
          }))
        );
      }
      if (Array.isArray(staffRes)) {
        setStaffList(staffRes);
      }
    } catch {
      try {
        const saved = localStorage.getItem('vargon_ios_manage');
        if (saved) {
          const p = JSON.parse(saved);
          if (Array.isArray(p.finances)) setFinances(p.finances);
          if (Array.isArray(p.leaves)) setLeaves(p.leaves);
          if (Array.isArray(p.qrs)) setQrs(p.qrs);
        }
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    loadOffice();
    loadSupabaseModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('vargon_ios_manage', JSON.stringify({ finances, leaves, qrs }));
    } catch {
      // ignore
    }
  }, [finances, leaves, qrs]);

  const totalThu = finances.filter((f) => f.type === 'thu').reduce((s, f) => s + f.amount, 0);
  const totalChi = finances.filter((f) => f.type === 'chi').reduce((s, f) => s + f.amount, 0);

  const addFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(finAmount);
    if (!finTitle.trim() || !(amt > 0)) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('farm_finances')
      .insert([{ type: finType, title: finTitle.trim(), amount: amt, record_date: today }])
      .select()
      .single();
    setFinances((prev) => [
      {
        id: String(data?.id || Date.now()),
        type: finType,
        title: finTitle.trim(),
        amount: amt,
        date: today,
      },
      ...prev,
    ]);
    setFinTitle('');
    setFinAmount('');
  };

  const deleteFinance = async (id: string) => {
    setFinances((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('farm_finances').delete().eq('id', id);
  };

  const addOfficeRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeTitle.trim()) return;
    await fetch(`${backendUrl}/api/office/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: officeTitle.trim(),
        category: officeCategory,
        pen_name: penName,
      }),
    });
    setOfficeTitle('');
    await loadOffice();
  };

  const deleteOfficeRecord = async (id: string | number) => {
    await fetch(`${backendUrl}/api/office/records/${id}`, { method: 'DELETE' });
    await loadOffice();
  };

  const summarizeOffice = async () => {
    setOfficeLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/office/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 15 }),
      });
      if (res.ok) {
        const json = await res.json();
        setOfficeSummary(json.summary || 'Đã tổng hợp dữ liệu Office.');
      }
    } finally {
      setOfficeLoading(false);
    }
  };

  const addLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStaff.trim() || !leaveReason.trim()) return;
    const { data } = await supabase
      .from('farm_hr_leaves')
      .insert([{ staff_name: leaveStaff.trim(), reason: leaveReason.trim(), leave_date: new Date().toISOString().slice(0, 10), status: 'pending' }])
      .select()
      .single();
    setLeaves((prev) => [
      { id: String(data?.id || Date.now()), staff: leaveStaff.trim(), reason: leaveReason.trim(), status: 'pending' },
      ...prev,
    ]);
    setLeaveStaff('');
    setLeaveReason('');
  };

  const updateLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLeaves((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase.from('farm_hr_leaves').update({ status }).eq('id', id);
  };

  const addQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaStaff.trim() || !quotaTask.trim()) return;
    const tgt = Number(quotaTarget) || 100;
    const { data } = await supabase
      .from('farm_hr_quotas')
      .insert([{ staff_name: quotaStaff.trim(), task_name: quotaTask.trim(), target: tgt, completed: 0, unit: 'kg' }])
      .select()
      .single();
    setQuotas((prev) => [
      { id: String(data?.id || Date.now()), staff_name: quotaStaff.trim(), task_name: quotaTask.trim(), target: tgt, completed: 0, unit: 'kg' },
      ...prev,
    ]);
    setQuotaStaff('');
    setQuotaTask('');
    setQuotaTarget('');
  };

  const addQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrProduct.trim() || !qrLot.trim()) return;
    const { data } = await supabase
      .from('farm_video_qrs')
      .insert([{ product_name: qrProduct.trim(), lot_code: qrLot.trim(), video_url: qrUrl.trim() || 'https://v-argon.farm' }])
      .select()
      .single();
    setQrs((prev) => [
      { id: String(data?.id || Date.now()), product: qrProduct.trim(), lot: qrLot.trim(), url: qrUrl.trim() || 'https://v-argon.farm' },
      ...prev,
    ]);
    setQrProduct('');
    setQrLot('');
    setQrUrl('');
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-[15px] font-bold text-slate-900">Quản lý & Vận hành</h2>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {penName}
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { key: 'farm', label: 'Đàn/Vườn & Kho', icon: Sprout },
            { key: 'finance', label: 'Thu Chi', icon: Wallet },
            { key: 'office', label: 'Office', icon: Table2 },
            { key: 'hr', label: 'Nhân Sự', icon: Users },
            { key: 'qr', label: 'Tem QR', icon: QrCode },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key as SubTab)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subTab === 'farm' && (
        <IosFarmOperations
          penId={penId}
          penName={penName}
          penType={penType}
          pens={pens}
          onRefreshParent={onRefreshParent}
        />
      )}

      {subTab === 'finance' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 block">Tổng Thu</span>
              <strong className="text-[13px] font-extrabold text-emerald-900">{totalThu.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100">
              <span className="text-[10px] font-bold text-rose-700 block">Tổng Chi</span>
              <strong className="text-[13px] font-extrabold text-rose-900">{totalChi.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div className="bg-sky-50 rounded-2xl p-3 border border-sky-100">
              <span className="text-[10px] font-bold text-sky-700 block">Lợi Nhuận</span>
              <strong className="text-[13px] font-extrabold text-sky-900">{(totalThu - totalChi).toLocaleString('vi-VN')}đ</strong>
            </div>
          </div>

          <form onSubmit={addFinance} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2.5">
            <div className="flex gap-2">
              <button type="button" onClick={() => setFinType('thu')} className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold ${finType === 'thu' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                + Khoản Thu
              </button>
              <button type="button" onClick={() => setFinType('chi')} className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold ${finType === 'chi' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                - Khoản Chi
              </button>
            </div>
            <input type="text" value={finTitle} onChange={(e) => setFinTitle(e.target.value)} placeholder="Nội dung thu/chi..." className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px]" />
            <div className="flex gap-2">
              <input type="number" value={finAmount} onChange={(e) => setFinAmount(e.target.value)} placeholder="Số tiền (VNĐ)" className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px]" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[13px] font-bold inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Lưu
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate-800">Sổ Thu Chi ({finances.length})</span>
              <button
                type="button"
                onClick={() => downloadCsv('thu-chi-trang-trai', ['Loại', 'Nội dung', 'Số tiền', 'Ngày'], finances.map((f) => [f.type, f.title, f.amount, f.date]))}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất CSV
              </button>
            </div>
            {finances.map((f) => (
              <div key={f.id} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{f.title}</p>
                  <p className="text-[11px] text-slate-500">{f.date}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[13px] font-extrabold ${f.type === 'thu' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {f.type === 'thu' ? '+' : '-'}{f.amount.toLocaleString('vi-VN')}đ
                  </span>
                  <button type="button" onClick={() => deleteFinance(f.id)} className="text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'office' && (
        <div className="space-y-3">
          <form onSubmit={addOfficeRecord} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <div className="flex gap-2">
              <input type="text" value={officeTitle} onChange={(e) => setOfficeTitle(e.target.value)} placeholder="Thêm ghi chép / công việc Office..." className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <select value={officeCategory} onChange={(e) => setOfficeCategory(e.target.value)} className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]">
                <option value="Nhật ký">Nhật ký</option>
                <option value="Vận hành">Vận hành</option>
                <option value="Kế hoạch">Kế hoạch</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">
                + Lưu Office
              </button>
              <button type="button" onClick={summarizeOffice} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-[12px] font-bold inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI Tổng hợp
              </button>
            </div>
          </form>

          {officeSummary && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-[12px] text-indigo-900 whitespace-pre-wrap">
              {officeSummary}
            </div>
          )}

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900">V-Argon Office ({officeRows.length})</span>
              <button type="button" onClick={loadOffice} className="text-[12px] font-bold text-emerald-700 inline-flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${officeLoading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
            {officeRows.length === 0 ? (
              <p className="text-[12px] text-slate-500 py-3 text-center">Chưa có bản ghi Office nào.</p>
            ) : (
              officeRows.map((row, idx) => (
                <div key={row.id || idx} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between gap-2 text-[12px]">
                  <div className="min-w-0">
                    <strong className="text-slate-900 block truncate">{row.title || row.task_name || `Bản ghi #${idx + 1}`}</strong>
                    <span className="text-slate-500 text-[11px]">{row.category || row.status || 'Office'}</span>
                  </div>
                  {row.id && (
                    <button type="button" onClick={() => deleteOfficeRecord(row.id)} className="text-slate-400 hover:text-rose-600 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === 'hr' && (
        <div className="space-y-3">
          {/* Nghỉ phép */}
          <form onSubmit={addLeave} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Đăng ký / Duyệt nghỉ phép</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={leaveStaff} onChange={(e) => setLeaveStaff(e.target.value)} placeholder="Tên nhân viên" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <input type="text" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Lý do" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
            </div>
            <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">Gửi đơn nghỉ phép</button>
          </form>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[12px] font-bold text-slate-800 block">Đơn nghỉ phép ({leaves.length})</span>
            {leaves.map((l) => (
              <div key={l.id} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-900">{l.staff}</p>
                  <p className="text-[11px] text-slate-500">{l.reason}</p>
                </div>
                <div className="flex items-center gap-1">
                  {l.status === 'pending' ? (
                    <>
                      <button type="button" onClick={() => updateLeaveStatus(l.id, 'approved')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold">Duyệt</button>
                      <button type="button" onClick={() => updateLeaveStatus(l.id, 'rejected')} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold">Từ chối</button>
                    </>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {l.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Khoán sản lượng */}
          <form onSubmit={addQuota} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Giao khoán sản lượng ({quotas.length})</span>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={quotaStaff} onChange={(e) => setQuotaStaff(e.target.value)} placeholder="Nhân viên" className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <input type="text" value={quotaTask} onChange={(e) => setQuotaTask(e.target.value)} placeholder="Công việc" className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <input type="number" value={quotaTarget} onChange={(e) => setQuotaTarget(e.target.value)} placeholder="Mục tiêu" className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
            </div>
            <button type="submit" className="w-full py-2 rounded-xl bg-sky-600 text-white text-[12px] font-bold">+ Giao khoán</button>
            {quotas.map((q) => (
              <div key={q.id} className="p-2 rounded-xl bg-slate-50 flex justify-between text-[12px]">
                <span><strong>{q.staff_name}</strong> • {q.task_name}</span>
                <span className="font-bold text-emerald-700">{q.completed}/{q.target} {q.unit}</span>
              </div>
            ))}
          </form>

          {staffList.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-1.5">
              <span className="text-[12px] font-bold text-slate-900 block">Bảng lương nhân sự ({staffList.length})</span>
              {staffList.map((s) => (
                <div key={s.id} className="p-2 rounded-xl bg-slate-50 flex justify-between text-[12px]">
                  <span className="font-bold">{s.full_name || s.name || s.id}</span>
                  <span className="text-emerald-700 font-bold">{Number(s.daily_wage || 0).toLocaleString('vi-VN')} đ/ngày</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'qr' && (
        <div className="space-y-3">
          <form onSubmit={addQr} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Tạo Tem QR Truy Xuất</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={qrProduct} onChange={(e) => setQrProduct(e.target.value)} placeholder="Tên sản phẩm" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <input type="text" value={qrLot} onChange={(e) => setQrLot(e.target.value)} placeholder="Mã lô (LOT-...)" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
            </div>
            <input type="url" value={qrUrl} onChange={(e) => setQrUrl(e.target.value)} placeholder="Link video quy trình (https://...)" className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
            <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">+ Tạo Tem QR</button>
          </form>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Danh sách Tem QR ({qrs.length})</span>
            {qrs.map((q) => (
              <div key={q.id} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-900">{q.product}</p>
                  <p className="text-[11px] text-slate-500">Lô: {q.lot}</p>
                </div>
                <a href={q.url} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold inline-flex items-center gap-1">
                  Video <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
