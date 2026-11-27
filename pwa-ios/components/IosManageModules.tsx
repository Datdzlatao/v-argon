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
import { enrollStaffFace } from '../lib/api';
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

function exportExcelXls(filename: string, sheetName: string, headers: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const head = headers.map((h) => `<th style="background:#0f6b35;color:#fff;padding:6px 10px;border:1px solid #cbd5e1;">${esc(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px;border:1px solid #cbd5e1;">${esc(c)}</td>`).join('')}</tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table style="border-collapse:collapse;font-family:Arial;font-size:13px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IosManageModules({
  penId = '',
  penName,
  penType = 'livestock',
  pens = [],
  onRefreshParent,
  onNotify,
  onQuickAccessCrop,
}: {
  penId?: string;
  penName: string;
  penType?: string;
  pens?: Array<{ id: string; name: string; type?: string }>;
  onRefreshParent?: () => void;
  onNotify?: (msg: string) => void;
  onQuickAccessCrop?: (cropId: string, penId?: string) => void;
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
  const [officeDate, setOfficeDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [officeCatFilter, setOfficeCatFilter] = useState('all');
  const [officeTitle, setOfficeTitle] = useState('');
  const [officeCode, setOfficeCode] = useState('');
  const [officeAmount, setOfficeAmount] = useState('');
  const [officeNote, setOfficeNote] = useState('');
  const [officeCategory, setOfficeCategory] = useState('thu_chi');
  const [officeSummary, setOfficeSummary] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState<string | number | null>(null);
  const [editOfficeItem, setEditOfficeItem] = useState('');
  const [editOfficeNote, setEditOfficeNote] = useState('');

  // HR: Leaves, Quotas, Staff Wages
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [leaveStaff, setLeaveStaff] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [quotaStaff, setQuotaStaff] = useState('');
  const [quotaTask, setQuotaTask] = useState('');
  const [quotaTarget, setQuotaTarget] = useState('');

  // QR Cây Trồng
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [cropsList, setCropsList] = useState<Array<{ id: string | number; name: string; pen_id?: string; quantity?: number; status?: string }>>([]);
  const [selectedQrCropId, setSelectedQrCropId] = useState('');
  const [qrNote, setQrNote] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('crops').select('id,name,pen_id,quantity,status').order('id', { ascending: false });
        if (data && data.length > 0) {
          setCropsList(data);
          setSelectedQrCropId(String(data[0].id));
          return;
        }
      } catch {}
      try {
        const res = await fetch(`${backendUrl}/api/crops`);
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            setCropsList(arr);
            setSelectedQrCropId(String(arr[0].id));
          }
        }
      } catch {}
    })();
  }, []);

  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  const loadOffice = async (dateVal = officeDate, catVal = officeCatFilter) => {
    setOfficeLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (dateVal) qs.set('report_date', dateVal);
      if (catVal && catVal !== 'all') qs.set('category', catVal);
      const res = await fetch(`${backendUrl}/api/office/records?${qs.toString()}`);
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
        supabase.from('staff').select('*').order('id'),
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
      if (staffRes.data && staffRes.data.length > 0) {
        setStaffList(staffRes.data);
      } else {
        const fallbackStaff = await fetch(`${backendUrl}/api/staff`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
        if (Array.isArray(fallbackStaff)) {
          setStaffList(fallbackStaff);
        }
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

  useEffect(() => {
    loadOffice(officeDate, officeCatFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeDate, officeCatFilter]);

  const addOfficeRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeTitle.trim()) return;
    await fetch(`${backendUrl}/api/office/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_date: officeDate,
        category: officeCategory,
        code: officeCode.trim() || `MAN-${officeRows.length + 1}`,
        item: officeTitle.trim(),
        quantity_or_amount: Number(officeAmount) || 0,
        status: 'Ghi nhận thủ công',
        note: officeNote.trim() || `Ghi nhận từ PWA (${penName})`,
      }),
    });
    setOfficeTitle('');
    setOfficeCode('');
    setOfficeAmount('');
    setOfficeNote('');
    await loadOffice(officeDate, officeCatFilter);
  };

  const saveEditOffice = async (id: string | number) => {
    await fetch(`${backendUrl}/api/office/records/${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: editOfficeItem.trim(), note: editOfficeNote.trim() }),
    }).catch(() => {});
    setEditingOfficeId(null);
    await loadOffice(officeDate, officeCatFilter);
  };

  const deleteOfficeRecord = async (id: string | number) => {
    await fetch(`${backendUrl}/api/office/records/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    await loadOffice(officeDate, officeCatFilter);
  };

  const summarizeOffice = async () => {
    setOfficeLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/office/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: officeDate }),
      });
      if (res.ok) {
        const json = await res.json();
        setOfficeSummary(`Agent đã tổng hợp ${json.count || 0} bản ghi ngày ${json.report_date || officeDate}.`);
        await loadOffice(officeDate, officeCatFilter);
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
    const crop = cropsList.find((c) => String(c.id) === String(selectedQrCropId));
    if (!crop) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://v-argon.farm';
    const quickUrl = `${origin}/?crop_id=${crop.id}${crop.pen_id ? `&pen_id=${encodeURIComponent(crop.pen_id)}` : ''}`;
    const lotLabel = `CROP-${crop.id}${crop.pen_id ? ` • Khu ${crop.pen_id}` : ''}`;
    const { data } = await supabase
      .from('farm_video_qrs')
      .insert([{
        product_name: crop.name,
        lot_code: lotLabel,
        video_url: quickUrl,
        note: qrNote.trim() || `Truy cập nhanh cây trồng ${crop.name}`,
      }])
      .select()
      .single();
    setQrs((prev) => [
      { id: String(data?.id || Date.now()), product: crop.name, lot: lotLabel, url: quickUrl },
      ...prev,
    ]);
    setQrNote('');
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
                onClick={() => exportExcelXls('thu-chi-trang-trai', 'Thu Chi', ['Loại', 'Nội dung', 'Số tiền', 'Ngày'], finances.map((f) => [f.type, f.title, f.amount, f.date]))}
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

      {subTab === 'office' && (() => {
        const eodRow = officeRows.find((r) => r.category === 'tong_ket');
        const countBy = (cat: string) => officeRows.filter((r) => r.category === cat).length;
        const formatHour = (r: any) => {
          if (r.hour_slot) return r.hour_slot;
          if (r.timestampt) {
            try { return new Date(r.timestampt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); } catch {}
          }
          return '--:--';
        };
        const CAT_LABELS: Record<string, string> = {
          tong_ket: 'Tổng kết ngày',
          thu_chi: 'Thu chi',
          xuat_nhap_kho: 'Xuất nhập kho',
          xuat_chuong: 'Xuất chuồng',
          thu_hoach: 'Thu hoạch',
          nhan_su_khoan: 'Nhân sự & Khoán',
          thong_bao: 'Thông báo',
          nhat_ky_vat_nuoi: 'Nhật ký vật nuôi',
          nhat_ky_tang_truong: 'Nhật ký tăng trưởng',
        };
        return (
        <div className="space-y-3">
          {/* Date & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={officeDate}
              onChange={(e) => setOfficeDate(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-white border border-black/10 text-[12px] font-semibold"
            />
            <button type="button" onClick={summarizeOffice} className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 text-white text-[12px] font-bold inline-flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Tổng hợp cuối ngày
            </button>
            <button
              type="button"
              onClick={() =>
                exportExcelXls(
                  `v-argon-office-${officeDate}`,
                  'V-Argon Office',
                  ['Giờ (timestampt)', 'Phân loại', 'Mã', 'Nội dung', 'Số lượng / Giá trị', 'Đơn vị', 'Trạng thái', 'Ghi chú'],
                  officeRows.map((r) => [
                    r.timestampt || formatHour(r),
                    CAT_LABELS[r.category || ''] || r.category || '',
                    r.code || '',
                    r.item || r.title || '',
                    r.quantity_or_amount ?? 0,
                    r.unit || '',
                    r.status || '',
                    r.note || '',
                  ])
                )
              }
              className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12px] font-bold inline-flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
          </div>

          {eodRow && (
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-emerald-50 p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-purple-900">
                <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> {eodRow.item || eodRow.title}</span>
                <span>{formatHour(eodRow)}</span>
              </div>
              <p className="text-[12px] text-slate-700">{eodRow.note}</p>
            </div>
          )}

          {/* 9 Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: `Tất cả (${officeRows.length})` },
              { id: 'thu_chi', label: `Thu chi (${countBy('thu_chi')})` },
              { id: 'xuat_nhap_kho', label: `Xuất nhập kho (${countBy('xuat_nhap_kho')})` },
              { id: 'xuat_chuong', label: `Xuất chuồng (${countBy('xuat_chuong')})` },
              { id: 'thu_hoach', label: `Thu hoạch (${countBy('thu_hoach')})` },
              { id: 'nhan_su_khoan', label: `Nhân sự & Khoán (${countBy('nhan_su_khoan')})` },
              { id: 'thong_bao', label: `Thông báo (${countBy('thong_bao')})` },
              { id: 'nhat_ky_vat_nuoi', label: `Vật nuôi (${countBy('nhat_ky_vat_nuoi')})` },
              { id: 'nhat_ky_tang_truong', label: `Tăng trưởng (${countBy('nhat_ky_tang_truong')})` },
              { id: 'tong_ket', label: 'Tổng kết' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOfficeCatFilter(c.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  officeCatFilter === c.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-black/5'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <form onSubmit={addOfficeRecord} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select value={officeCategory} onChange={(e) => setOfficeCategory(e.target.value)} className="px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                <option value="thu_chi">Thu chi</option>
                <option value="xuat_nhap_kho">Xuất nhập kho</option>
                <option value="xuat_chuong">Xuất chuồng</option>
                <option value="thu_hoach">Thu hoạch</option>
                <option value="nhan_su_khoan">Nhân sự & Khoán</option>
                <option value="thong_bao">Thông báo</option>
                <option value="nhat_ky_vat_nuoi">Nhật ký vật nuôi</option>
                <option value="nhat_ky_tang_truong">Nhật ký tăng trưởng</option>
              </select>
              <input type="text" value={officeCode} onChange={(e) => setOfficeCode(e.target.value)} placeholder="Mã (LO-01)" className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]" />
              <input type="number" value={officeAmount} onChange={(e) => setOfficeAmount(e.target.value)} placeholder="SL / Tiền" className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]" />
            </div>
            <input type="text" value={officeTitle} onChange={(e) => setOfficeTitle(e.target.value)} placeholder="Nội dung bản ghi Office..." className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
            <div className="flex gap-2">
              <input type="text" value={officeNote} onChange={(e) => setOfficeNote(e.target.value)} placeholder="Ghi chú..." className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">
                + Lưu
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
              <button type="button" onClick={() => loadOffice(officeDate, officeCatFilter)} className="text-[12px] font-bold text-emerald-700 inline-flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${officeLoading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
            {officeRows.length === 0 ? (
              <p className="text-[12px] text-slate-500 py-3 text-center">Chưa có bản ghi Office nào cho ngày {officeDate}.</p>
            ) : (
              officeRows.map((row, idx) => (
                <div key={row.id || idx} className="p-2.5 rounded-xl bg-slate-50 space-y-1.5 text-[12px]">
                  {editingOfficeId === row.id ? (
                    <div className="space-y-1.5">
                      <input value={editOfficeItem} onChange={(e) => setEditOfficeItem(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px]" />
                      <input value={editOfficeNote} onChange={(e) => setEditOfficeNote(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px]" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveEditOffice(row.id)} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">Lưu</button>
                        <button type="button" onClick={() => setEditingOfficeId(null)} className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{formatHour(row)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {CAT_LABELS[row.category || ''] || row.category || 'Office'}
                          </span>
                          {row.code && <span className="text-[10px] font-bold text-slate-500">{row.code}</span>}
                        </div>
                        <strong className="text-slate-900 block truncate mt-0.5">{row.item || row.title || `Bản ghi #${idx + 1}`}</strong>
                        <span className="text-slate-500 text-[11px] block">
                          {row.quantity_or_amount ? `${Number(row.quantity_or_amount).toLocaleString('vi-VN')} ${row.unit || ''}` : ''}
                          {row.status ? ` • ${row.status}` : ''}
                        </span>
                        {row.note && <span className="text-slate-600 text-[11px] block mt-0.5">{row.note}</span>}
                      </div>
                      {row.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOfficeId(row.id);
                              setEditOfficeItem(row.item || row.title || '');
                              setEditOfficeNote(row.note || '');
                            }}
                            className="text-emerald-700 text-[11px] font-bold px-1.5 py-0.5"
                          >
                            Sửa
                          </button>
                          <button type="button" onClick={() => deleteOfficeRecord(row.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        );
      })()}

      {subTab === 'hr' && (
        <IosHrFaceEnrollCard penId={penId} onNotify={onNotify} />
      )}

      {subTab === 'qr' && (
        <div className="space-y-3">
          <form onSubmit={addQr} className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Tạo Mã QR Cây Trồng (Truy Cập Nhanh)</span>
            <select
              value={selectedQrCropId}
              onChange={(e) => setSelectedQrCropId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-semibold"
              required
            >
              {cropsList.length === 0 ? (
                <option value="">-- Chưa có cây trồng --</option>
              ) : (
                cropsList.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    🌱 {c.name} (ID #{c.id}{c.pen_id ? ` • Khu ${c.pen_id}` : ''})
                  </option>
                ))
              )}
            </select>
            <input type="text" value={qrNote} onChange={(e) => setQrNote(e.target.value)} placeholder="Ghi chú thêm (tùy chọn)" className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
            <button type="submit" disabled={!selectedQrCropId} className="w-full py-2 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-bold">+ Tạo Mã QR Cây Trồng</button>
          </form>

          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/5 space-y-2">
            <span className="text-[13px] font-bold text-slate-900 block">Danh sách Mã QR ({qrs.length})</span>
            {qrs.map((q) => {
              const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(q.url)}`;
              return (
                <div key={q.id} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between gap-2.5">
                  <img src={qrImgUrl} alt={q.product} className="w-14 h-14 rounded-lg border border-slate-200 bg-white p-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{q.product}</p>
                    <p className="text-[11px] text-slate-500 truncate">{q.lot}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const m = String(q.url || '').match(/crop_id=([^&]+)/);
                        const pm = String(q.url || '').match(/pen_id=([^&]+)/);
                        if (m && onQuickAccessCrop) {
                          onQuickAccessCrop(decodeURIComponent(m[1]), pm ? decodeURIComponent(pm[1]) : undefined);
                        } else if (q.url) {
                          window.open(q.url, '_blank', 'noreferrer');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      Mở <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setQrs((prev) => prev.filter((x) => x.id !== q.id));
                        await supabase.from('farm_video_qrs').delete().eq('id', q.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IosHrFaceEnrollCard({
  penId,
  onNotify,
}: {
  penId: string;
  onNotify?: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Kỹ thuật viên');
  const [fileThang, setFileThang] = useState<File | null>(null);
  const [fileTrai, setFileTrai] = useState<File | null>(null);
  const [filePhai, setFilePhai] = useState<File | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !fileThang) {
      setErr('Vui lòng nhập họ tên và chọn ít nhất ảnh nhìn thẳng.');
      return;
    }
    setEnrolling(true);
    try {
      const res = await enrollStaffFace({
        staffName: name,
        role,
        penId: penId || '123',
        fileThang,
        fileTrai,
        filePhai,
      });
      const createdId = res?.staff?.id ? ` (ID: ${res.staff.id})` : '';
      onNotify?.(`Đã thêm khuôn mặt nhân sự ${name}${createdId}`);
      setName('');
      setFileThang(null);
      setFileTrai(null);
      setFilePhai(null);
    } catch (e: any) {
      setErr(e?.message || 'Đăng ký khuôn mặt thất bại.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-slate-900">Thêm khuôn mặt nhân sự mới</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">ID tự tăng</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Mã nhân viên sẽ được tự động tăng trong database khi lưu hồ sơ khuôn mặt.
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Họ và tên nhân sự"
        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]"
        required
      />
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Chức vụ"
        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]"
      />
      <div className="space-y-1.5 text-[11px]">
        <label className="block font-semibold text-slate-700">1. Ảnh nhìn thẳng (bắt buộc):</label>
        <input type="file" accept="image/*" onChange={(e) => setFileThang(e.target.files?.[0] || null)} className="w-full" />
        <label className="block font-semibold text-slate-700">2. Ảnh nghiêng trái (tùy chọn):</label>
        <input type="file" accept="image/*" onChange={(e) => setFileTrai(e.target.files?.[0] || null)} className="w-full" />
        <label className="block font-semibold text-slate-700">3. Ảnh nghiêng phải (tùy chọn):</label>
        <input type="file" accept="image/*" onChange={(e) => setFilePhai(e.target.files?.[0] || null)} className="w-full" />
      </div>
      {err && <p className="text-[12px] text-rose-600 font-medium">{err}</p>}
      <button
        type="submit"
        disabled={enrolling}
        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-50"
      >
        {enrolling ? 'Đang trích xuất khuôn mặt...' : '+ Thêm khuôn mặt nhân sự mới'}
      </button>
    </form>
  );
}
