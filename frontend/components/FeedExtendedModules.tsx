'use client';

import React, { useEffect, useState } from 'react';
import {
  Wallet,
  Table2,
  QrCode,
  TrendingUp,
  Globe,
  Users,
  Search,
  ExternalLink,
  FileSpreadsheet,
  Video,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
  Database,
  HardDrive,
  Bot,
  Clock,
  RefreshCw,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { exportTableToExcel } from '../lib/export-excel';
import {
  OfficeRecordItem,
  StaffWageItem,
  fetchOfficeRecordsAPI,
  triggerOfficeSummaryAPI,
  createOfficeRecordAPI,
  updateOfficeRecordAPI,
  deleteOfficeRecordAPI,
  fetchStaffListWithWageAPI,
  fetchTodayAttendanceAPI,
  updateStaffWageAPI,
} from '../lib/agent-api';

type ModuleTab = 'finance' | 'office' | 'hr' | 'qr';

interface FinanceRecord {
  id: string | number;
  type: 'thu' | 'chi';
  title: string;
  amount: number;
  debt_note: string;
  record_date: string;
}

type OfficeRecord = OfficeRecordItem;

interface LeaveRecord {
  id: string | number;
  staff_name: string;
  reason: string;
  leave_date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface QuotaRecord {
  id: string | number;
  staff_name: string;
  task_title: string;
  completed_qty: number;
  target_qty: number;
  unit: string;
}

interface ProductVideoQr {
  id: string | number;
  product_name: string;
  lot_code: string;
  video_url: string;
  note: string;
}

const DEFAULT_FINANCES: FinanceRecord[] = [
  {
    id: 'local_f1',
    type: 'thu',
    title: 'Xuất bán 450kg Dưa lưới lô #DL09',
    amount: 18000000,
    debt_note: '',
    record_date: 'Hôm nay',
  },
  {
    id: 'local_f2',
    type: 'chi',
    title: 'Nhập phân bón NPK & chế phẩm sinh học',
    amount: 6400000,
    debt_note: 'Còn nợ đại lý 1.400.000đ',
    record_date: 'Hôm qua',
  },
];

const DEFAULT_OFFICE: OfficeRecord[] = [];

const DEFAULT_LEAVES: LeaveRecord[] = [
  {
    id: 'local_l1',
    staff_name: 'Lê Văn Cường',
    reason: 'Việc gia đình',
    leave_date: '26/11/2026',
    status: 'pending',
  },
  {
    id: 'local_l2',
    staff_name: 'Trần Thị Bình',
    reason: 'Nghỉ phép năm (đã bàn giao Tổ B)',
    leave_date: '25/11/2026',
    status: 'approved',
  },
];

const DEFAULT_QUOTAS: QuotaRecord[] = [
  {
    id: 'local_q1',
    staff_name: 'Nguyễn Văn An',
    task_title: 'Chăm sóc Thửa A1',
    completed_qty: 18,
    target_qty: 20,
    unit: 'cây',
  },
  {
    id: 'local_q2',
    staff_name: 'Phạm Minh Đức',
    task_title: 'Thu hoạch Nhà màng B2',
    completed_qty: 320,
    target_qty: 400,
    unit: 'kg',
  },
];

const DEFAULT_QRS: ProductVideoQr[] = [
  {
    id: 'local_qr1',
    product_name: 'Sầu riêng Ri6 — Lô thu hoạch Đợt 1',
    lot_code: 'LOT-SR-26',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    note: 'Video quay quá trình chăm sóc hữu cơ, cắt tỉa và đóng gói tại vườn.',
  },
  {
    id: 'local_qr2',
    product_name: 'Dưa lưới TL3 Nhà màng B2',
    lot_code: 'LOT-DL-09',
    video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    note: 'Quy trình tưới nhỏ giọt tự động và kiểm tra độ ngọt trước thu hoạch.',
  },
];

export default function FeedExtendedModules({
  penName,
  userId,
  onQuickAccessCrop,
}: {
  penName: string;
  userId?: string | null;
  onQuickAccessCrop?: (cropId: string, penId?: string) => void;
}) {
  const [tab, setTab] = useState<ModuleTab>('finance');
  const [dbSynced, setDbSynced] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State dữ liệu
  const [finances, setFinances] = useState<FinanceRecord[]>(DEFAULT_FINANCES);
  const [officeRows, setOfficeRows] = useState<OfficeRecord[]>(DEFAULT_OFFICE);
  const [leaves, setLeaves] = useState<LeaveRecord[]>(DEFAULT_LEAVES);
  const [quotas, setQuotas] = useState<QuotaRecord[]>(DEFAULT_QUOTAS);
  const [videoQrs, setVideoQrs] = useState<ProductVideoQr[]>(DEFAULT_QRS);

  // Form & Edit states — Thu chi
  const [finType, setFinType] = useState<'thu' | 'chi'>('thu');
  const [finTitle, setFinTitle] = useState('');
  const [finAmount, setFinAmount] = useState('');
  const [finDebt, setFinDebt] = useState('');
  const [editingFinId, setEditingFinId] = useState<string | number | null>(null);
  const [editFinDraft, setEditFinDraft] = useState<Partial<FinanceRecord>>({});

  // Form & Edit states — Office (Agent Tổng Hợp Cuối Ngày)
  const [officeDate, setOfficeDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [officeCategory, setOfficeCategory] = useState<string>('all');
  const [isSummarizingOffice, setIsSummarizingOffice] = useState<boolean>(false);
  const [officeSummaryMsg, setOfficeSummaryMsg] = useState<string>('');
  const [newRowCode, setNewRowCode] = useState('');
  const [newRowItem, setNewRowItem] = useState('');
  const [newRowCategory, setNewRowCategory] = useState('thu_chi');
  const [newRowAmount, setNewRowAmount] = useState('');
  const [newRowStatus, setNewRowStatus] = useState('Ghi nhận thủ công');
  const [newRowNote, setNewRowNote] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState<string | number | null>(null);
  const [editOfficeDraft, setEditOfficeDraft] = useState<Partial<OfficeRecord>>({});

  // Form states — HR & Tiền công nhân sự
  const [staffWages, setStaffWages] = useState<StaffWageItem[]>([]);
  const [todayAttLogs, setTodayAttLogs] = useState<any[]>([]);
  const [wageDrafts, setWageDrafts] = useState<Record<string, string>>({});
  const [workDaysDrafts, setWorkDaysDrafts] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(`smartfarm_workdays_${userId || 'demo'}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [savingWageId, setSavingWageId] = useState<string | null>(null);
  const [leaveStaff, setLeaveStaff] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [quotaStaff, setQuotaStaff] = useState('');
  const [quotaTask, setQuotaTask] = useState('');
  const [quotaTarget, setQuotaTarget] = useState('');
  const [quotaUnit, setQuotaUnit] = useState('kg');

  // Form & Edit states — QR Cây Trồng (Truy cập nhanh)
  const [cropsList, setCropsList] = useState<Array<{ id: string | number; name: string; pen_id?: string; quantity?: number; status?: string }>>([]);
  const [selectedQrCropId, setSelectedQrCropId] = useState<string>('');
  const [qrNote, setQrNote] = useState('');
  const [editingQrId, setEditingQrId] = useState<string | number | null>(null);
  const [editQrDraft, setEditQrDraft] = useState<Partial<ProductVideoQr>>({});

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
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${base}/api/crops`);
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

  const storageKey = `smartfarm_ext_${userId || 'demo'}`;

  // Load từ Supabase theo userId (nếu có) hoặc fallback localStorage
  useEffect(() => {
    let cancelled = false;

    const loadLocal = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.finances) setFinances(parsed.finances);
          if (parsed.officeRows) setOfficeRows(parsed.officeRows);
          if (parsed.leaves) setLeaves(parsed.leaves);
          if (parsed.quotas) setQuotas(parsed.quotas);
          if (parsed.videoQrs) setVideoQrs(parsed.videoQrs);
        }
      } catch {}
    };

    const loadFromDb = async () => {
      if (!userId) {
        setDbSynced(false);
        loadLocal();
        return;
      }

      setIsLoading(true);
      try {
        const [fRes, lRes, qRes, qrRes] = await Promise.all([
          supabase.from('farm_finances').select('*').eq('user_id', userId).order('id', { ascending: false }),
          supabase.from('farm_hr_leaves').select('*').eq('user_id', userId).order('id', { ascending: false }),
          supabase.from('farm_hr_quotas').select('*').eq('user_id', userId).order('id', { ascending: false }),
          supabase.from('farm_video_qrs').select('*').eq('user_id', userId).order('id', { ascending: false }),
        ]);

        if (cancelled) return;

        // Nếu bảng chưa tồn tại trong Supabase, dùng localStorage
        if (fRes.error || lRes.error || qRes.error || qrRes.error) {
          setDbSynced(false);
          loadLocal();
        } else {
          setDbSynced(true);
          setFinances((fRes.data as FinanceRecord[]) || []);
          setLeaves((lRes.data as LeaveRecord[]) || []);
          setQuotas((qRes.data as QuotaRecord[]) || []);
          setVideoQrs((qrRes.data as ProductVideoQr[]) || []);
        }
      } catch {
        if (!cancelled) {
          setDbSynced(false);
          loadLocal();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [userId, storageKey]);

  // Đồng bộ localStorage khi ở chế độ cục bộ
  useEffect(() => {
    if (!dbSynced) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ finances, officeRows, leaves, quotas, videoQrs })
        );
      } catch {}
    }
  }, [dbSynced, storageKey, finances, officeRows, leaves, quotas, videoQrs]);

  // --- CRUD HANDLERS: THU CHI ---
  const handleAddFinance = async () => {
    const amt = Number(finAmount);
    if (!finTitle.trim() || !amt) return;
    const payload = {
      type: finType,
      title: finTitle.trim(),
      amount: amt,
      debt_note: finDebt.trim(),
      record_date: new Date().toLocaleDateString('vi-VN'),
    };
    if (dbSynced && userId) {
      const { data } = await supabase
        .from('farm_finances')
        .insert([{ ...payload, user_id: userId }])
        .select()
        .single();
      if (data) setFinances((prev) => [data as FinanceRecord, ...prev]);
    } else {
      setFinances((prev) => [{ id: `f_${Date.now()}`, ...payload }, ...prev]);
    }
    setFinTitle('');
    setFinAmount('');
    setFinDebt('');
  };

  const handleSaveFinance = async (id: string | number) => {
    const updated = {
      type: editFinDraft.type || 'thu',
      title: String(editFinDraft.title || '').trim(),
      amount: Number(editFinDraft.amount || 0),
      debt_note: String(editFinDraft.debt_note || '').trim(),
    };
    if (!updated.title) return;
    if (dbSynced && userId) {
      await supabase.from('farm_finances').update(updated).eq('id', id).eq('user_id', userId);
    }
    setFinances((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
    setEditingFinId(null);
  };

  const handleDeleteFinance = async (id: string | number) => {
    if (dbSynced && userId) {
      await supabase.from('farm_finances').delete().eq('id', id).eq('user_id', userId);
    }
    setFinances((prev) => prev.filter((f) => f.id !== id));
  };

  // Load bảng `office` từ Backend Agent API (theo ngày & phân loại)
  const loadOfficeRecords = async (dateFilter = officeDate, catFilter = officeCategory) => {
    try {
      const res = await fetchOfficeRecordsAPI({
        report_date: dateFilter || undefined,
        category: catFilter,
        user_id: userId,
      });
      setOfficeRows(res.records || []);
    } catch {
      // Giữ nguyên state hiện tại nếu backend tạm thời offline
    }
  };

  useEffect(() => {
    loadOfficeRecords(officeDate, officeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeDate, officeCategory, userId]);

  const loadStaffWages = async () => {
    try {
      const [staffRes, attRes] = await Promise.all([
        fetchStaffListWithWageAPI(),
        fetchTodayAttendanceAPI(),
      ]);
      setStaffWages(staffRes || []);
      setTodayAttLogs(attRes || []);
      const drafts: Record<string, string> = {};
      (staffRes || []).forEach((s) => {
        drafts[s.id] = String(s.daily_wage ?? 300000);
      });
      setWageDrafts(drafts);
    } catch {}
  };

  useEffect(() => {
    loadStaffWages();
  }, []);

  const handleSaveStaffWage = async (staffId: string) => {
    const val = Number(wageDrafts[staffId] ?? 300000);
    if (Number.isNaN(val) || val < 0) return;
    setSavingWageId(staffId);
    try {
      const updated = await updateStaffWageAPI(staffId, val);
      setStaffWages((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, daily_wage: updated.daily_wage ?? val } : s))
      );
    } catch {}
    setSavingWageId(null);
  };

  // --- HANDLERS: V-ARGON OFFICE (AGENT TỔNG HỢP CUỐI NGÀY) ---
  const handleTriggerOfficeSummary = async () => {
    setIsSummarizingOffice(true);
    setOfficeSummaryMsg('');
    try {
      const res = await triggerOfficeSummaryAPI({
        target_date: officeDate,
        user_id: userId,
      });
      if (res.records) {
        if (officeCategory === 'all') {
          setOfficeRows(res.records);
        } else {
          await loadOfficeRecords(officeDate, officeCategory);
        }
      }
      setOfficeSummaryMsg(
        `Agent đã tổng hợp ${res.count || 0} bản ghi ngày ${res.report_date || officeDate} vào bảng office.`
      );
    } catch (err: any) {
      setOfficeSummaryMsg(err?.message || 'Không thể chạy Agent tổng hợp cuối ngày.');
    } finally {
      setIsSummarizingOffice(false);
    }
  };

  const handleAddOffice = async () => {
    if (!newRowItem.trim()) return;
    const now = new Date();
    const hourSlot = now.toTimeString().slice(0, 5);
    const payload: Partial<OfficeRecord> = {
      user_id: userId || undefined,
      report_date: officeDate,
      hour_slot: hourSlot,
      category: newRowCategory,
      code: newRowCode.trim() || `MAN-${officeRows.length + 1}`,
      item: newRowItem.trim(),
      quantity_or_amount: Number(newRowAmount || 0),
      unit: newRowCategory === 'thu_chi' ? 'VNĐ' : 'đv',
      status: newRowStatus.trim() || 'Ghi nhận thủ công',
      note: newRowNote.trim() || 'Ghi nhận thủ công từ V-Argon Office',
      timestampt: now.toISOString(),
    };
    try {
      const created = await createOfficeRecordAPI(payload);
      setOfficeRows((prev) => [created, ...prev]);
    } catch {
      setOfficeRows((prev) => [{ id: `r_${Date.now()}`, ...payload } as OfficeRecord, ...prev]);
    }
    setNewRowCode('');
    setNewRowItem('');
    setNewRowAmount('');
    setNewRowNote('');
  };

  const handleSaveOffice = async (id: string | number) => {
    const updated: Partial<OfficeRecord> = {
      code: String(editOfficeDraft.code || '').trim(),
      item: String(editOfficeDraft.item || '').trim(),
      status: String(editOfficeDraft.status || '').trim(),
      note: String(editOfficeDraft.note || '').trim(),
      quantity_or_amount:
        editOfficeDraft.quantity_or_amount !== undefined
          ? Number(editOfficeDraft.quantity_or_amount)
          : undefined,
    };
    if (!updated.item) return;
    try {
      await updateOfficeRecordAPI(id, updated);
    } catch {}
    setOfficeRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    setEditingOfficeId(null);
  };

  const handleDeleteOffice = async (id: string | number) => {
    try {
      await deleteOfficeRecordAPI(id);
    } catch {}
    setOfficeRows((prev) => prev.filter((r) => r.id !== id));
  };

  // --- CRUD HANDLERS: NHÂN SỰ & KHOÁN ---
  const handleAddLeave = async () => {
    if (!leaveStaff.trim() || !leaveReason.trim()) return;
    const payload: Omit<LeaveRecord, 'id'> = {
      staff_name: leaveStaff.trim(),
      reason: leaveReason.trim(),
      leave_date: leaveDate.trim() || new Date().toLocaleDateString('vi-VN'),
      status: 'pending',
    };
    if (dbSynced && userId) {
      const { data } = await supabase
        .from('farm_hr_leaves')
        .insert([{ ...payload, user_id: userId }])
        .select()
        .single();
      if (data) setLeaves((prev) => [data as LeaveRecord, ...prev]);
    } else {
      setLeaves((prev) => [{ id: `l_${Date.now()}`, ...payload }, ...prev]);
    }
    setLeaveStaff('');
    setLeaveReason('');
    setLeaveDate('');
  };

  const handleUpdateLeaveStatus = async (
    id: string | number,
    status: 'pending' | 'approved' | 'rejected'
  ) => {
    if (dbSynced && userId) {
      await supabase.from('farm_hr_leaves').update({ status }).eq('id', id).eq('user_id', userId);
    }
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const handleDeleteLeave = async (id: string | number) => {
    if (dbSynced && userId) {
      await supabase.from('farm_hr_leaves').delete().eq('id', id).eq('user_id', userId);
    }
    setLeaves((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddQuota = async () => {
    const target = Number(quotaTarget);
    if (!quotaStaff.trim() || !quotaTask.trim() || !target) return;
    const payload = {
      staff_name: quotaStaff.trim(),
      task_title: quotaTask.trim(),
      completed_qty: 0,
      target_qty: target,
      unit: quotaUnit.trim() || 'kg',
    };
    if (dbSynced && userId) {
      const { data } = await supabase
        .from('farm_hr_quotas')
        .insert([{ ...payload, user_id: userId }])
        .select()
        .single();
      if (data) setQuotas((prev) => [data as QuotaRecord, ...prev]);
    } else {
      setQuotas((prev) => [{ id: `q_${Date.now()}`, ...payload }, ...prev]);
    }
    setQuotaStaff('');
    setQuotaTask('');
    setQuotaTarget('');
  };

  const handleUpdateQuotaProgress = async (q: QuotaRecord, delta: number) => {
    const nextQty = Math.max(0, Math.min(q.target_qty, q.completed_qty + delta));
    if (dbSynced && userId) {
      await supabase
        .from('farm_hr_quotas')
        .update({ completed_qty: nextQty })
        .eq('id', q.id)
        .eq('user_id', userId);
    }
    setQuotas((prev) => prev.map((x) => (x.id === q.id ? { ...x, completed_qty: nextQty } : x)));
  };

  const handleDeleteQuota = async (id: string | number) => {
    if (dbSynced && userId) {
      await supabase.from('farm_hr_quotas').delete().eq('id', id).eq('user_id', userId);
    }
    setQuotas((prev) => prev.filter((x) => x.id !== id));
  };

  // --- CRUD HANDLERS: QR CÂY TRỒNG ---
  const handleAddQr = async () => {
    const crop = cropsList.find((c) => String(c.id) === String(selectedQrCropId));
    if (!crop) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://v-argon.farm';
    const quickUrl = `${origin}/?crop_id=${crop.id}${crop.pen_id ? `&pen_id=${encodeURIComponent(crop.pen_id)}` : ''}`;
    const payload = {
      product_name: crop.name,
      lot_code: `CROP-${crop.id}${crop.pen_id ? ` • Khu ${crop.pen_id}` : ''}`,
      video_url: quickUrl,
      note: qrNote.trim() || `Truy cập nhanh cây trồng ${crop.name} (${crop.quantity ?? 1} cây • ${crop.status || 'Growing'})`,
    };
    if (dbSynced && userId) {
      const { data } = await supabase
        .from('farm_video_qrs')
        .insert([{ ...payload, user_id: userId }])
        .select()
        .single();
      if (data) setVideoQrs((prev) => [data as ProductVideoQr, ...prev]);
    } else {
      setVideoQrs((prev) => [{ id: `qr_${Date.now()}`, ...payload }, ...prev]);
    }
    setQrNote('');
  };

  const handleSaveQr = async (id: string | number) => {
    const updated = {
      product_name: String(editQrDraft.product_name || '').trim(),
      lot_code: String(editQrDraft.lot_code || '').trim(),
      video_url: String(editQrDraft.video_url || '').trim(),
      note: String(editQrDraft.note || '').trim(),
    };
    if (!updated.product_name || !updated.video_url) return;
    if (dbSynced && userId) {
      await supabase.from('farm_video_qrs').update(updated).eq('id', id).eq('user_id', userId);
    }
    setVideoQrs((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
    setEditingQrId(null);
  };

  const handleDeleteQr = async (id: string | number) => {
    if (dbSynced && userId) {
      await supabase.from('farm_video_qrs').delete().eq('id', id).eq('user_id', userId);
    }
    setVideoQrs((prev) => prev.filter((x) => x.id !== id));
  };

  const totalThu = finances.filter((f) => f.type === 'thu').reduce((s, f) => s + Number(f.amount), 0);
  const totalChi = finances.filter((f) => f.type === 'chi').reduce((s, f) => s + Number(f.amount), 0);

  const TABS: Array<{ id: ModuleTab; label: string; icon: React.ElementType }> = [
    { id: 'finance', label: 'Thu chi & Công nợ', icon: Wallet },
    { id: 'office', label: 'V-Argon Office', icon: Table2 },
    { id: 'hr', label: 'Nhân sự & Khoán', icon: Users },
    { id: 'qr', label: 'QR Cây Trồng', icon: QrCode },
  ];

  useEffect(() => {
    try {
      localStorage.setItem(`smartfarm_workdays_${userId || 'demo'}`, JSON.stringify(workDaysDrafts));
    } catch {}
  }, [workDaysDrafts, userId]);

  const setStaffWorkDays = (staffId: string, days: number) => {
    const clamped = Math.max(0, Math.round(days * 10) / 10);
    setWorkDaysDrafts((prev) => ({ ...prev, [staffId]: clamped }));
  };

  const handleExportStaffPayrollExcel = () => {
    const rows = staffWages.map((st) => {
      const dailyWage = Number(wageDrafts[st.id] ?? st.daily_wage ?? 300000) || 0;
      const days = Number(workDaysDrafts[st.id] ?? 0) || 0;
      const total = Math.round(dailyWage * days);
      const logs = todayAttLogs.filter((l) => l.staff_id === st.id);
      const attStatus = logs.some((l) => l.check_type === 'check_out')
        ? 'Đủ công (đã tan ca)'
        : logs.length > 0
        ? 'Đang trong ca'
        : 'Chưa điểm danh';
      return [st.id, st.name, st.role || 'Nhân viên', attStatus, dailyWage, days, total];
    });
    const grandTotalDays = staffWages.reduce((s, st) => s + (Number(workDaysDrafts[st.id] ?? 0) || 0), 0);
    const grandTotalPay = staffWages.reduce((s, st) => {
      const w = Number(wageDrafts[st.id] ?? st.daily_wage ?? 300000) || 0;
      const d = Number(workDaysDrafts[st.id] ?? 0) || 0;
      return s + Math.round(w * d);
    }, 0);
    rows.push(['', 'TỔNG CỘNG', '', '', '', grandTotalDays, grandTotalPay]);
    exportTableToExcel(
      `bang-cong-luong-nhan-su-${new Date().toISOString().slice(0, 10)}`,
      'Bảng Công & Lương',
      ['Mã NV', 'Họ tên', 'Chức vụ', 'Điểm danh hôm nay', 'Tiền công / ngày (VNĐ)', 'Số ngày công', 'Thành tiền (VNĐ)'],
      rows
    );
  };

  return (
    <section
      id="section-extended"
      className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-fb-divider flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-emerald-50/80 to-white">
        <div>
          <h3 className="text-base font-extrabold text-fb-text flex items-center gap-2">
            <span>Phân Hệ Quản Lý Chung</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              {penName}
            </span>
          </h3>
          <p className="text-xs text-fb-muted mt-0.5">
            Lưu trữ CRUD theo tài khoản: Thu chi, V-Argon Office, Nhân sự &amp; khoán, QR Video sản xuất
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border ${
              dbSynced
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {dbSynced ? <Database className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
            <span>
              {isLoading
                ? 'Đang tải...'
                : dbSynced
                ? 'Đã kết nối Database tài khoản'
                : 'Lưu cục bộ (Chế độ dùng thử)'}
            </span>
          </span>
        </div>
      </div>

      {/* Tab Strip */}
      <div className="px-4 py-2.5 border-b border-fb-divider flex gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/70">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-fb-muted border border-fb-divider hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {/* 1. THU CHI & CÔNG NỢ (FULL CRUD) */}
        {tab === 'finance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-fb-text">
                Tổng hợp Thu Chi &amp; Công Nợ Vật Tư
              </span>
              <button
                type="button"
                onClick={() =>
                  exportTableToExcel(
                    `thu-chi-cong-no-${new Date().toISOString().slice(0, 10)}`,
                    'Thu Chi & Công Nợ',
                    ['Loại phiếu', 'Nội dung', 'Số tiền (VNĐ)', 'Ghi chú công nợ', 'Thời gian'],
                    [
                      ...finances.map((f) => [
                        f.type === 'thu' ? 'Phiếu Thu' : 'Phiếu Chi',
                        f.title,
                        f.type === 'thu' ? f.amount : -f.amount,
                        f.debt_note || '',
                        f.record_date,
                      ]),
                      ['TỔNG KẾT', 'Tổng Thu', totalThu, '', ''],
                      ['TỔNG KẾT', 'Tổng Chi', -totalChi, '', ''],
                      ['TỔNG KẾT', 'Tồn Quỹ Ròng', totalThu - totalChi, '', ''],
                    ]
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Excel Thu Chi</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-emerald-800 font-semibold">Tổng thu</div>
                <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
                  {totalThu.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                <div className="text-red-800 font-semibold">Tổng chi</div>
                <div className="text-sm font-extrabold text-red-700 mt-0.5">
                  {totalChi.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="rounded-xl bg-slate-100 border border-fb-divider p-3">
                <div className="text-fb-muted font-semibold">Tồn quỹ ròng</div>
                <div className="text-sm font-extrabold text-fb-text mt-0.5">
                  {(totalThu - totalChi).toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <select
                value={finType}
                onChange={(e) => setFinType(e.target.value as 'thu' | 'chi')}
                className="sm:col-span-2 bg-fb-bg text-xs font-bold rounded-xl px-3 py-2 border border-fb-divider"
              >
                <option value="thu">+ Phiếu Thu</option>
                <option value="chi">- Phiếu Chi</option>
              </select>
              <input
                type="text"
                value={finTitle}
                onChange={(e) => setFinTitle(e.target.value)}
                placeholder="Nội dung thu/chi..."
                className="sm:col-span-4 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
              />
              <input
                type="number"
                value={finAmount}
                onChange={(e) => setFinAmount(e.target.value)}
                placeholder="Số tiền (VNĐ)"
                className="sm:col-span-2 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
              />
              <input
                type="text"
                value={finDebt}
                onChange={(e) => setFinDebt(e.target.value)}
                placeholder="Ghi chú công nợ (nếu có)..."
                className="sm:col-span-3 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
              />
              <button
                type="button"
                onClick={handleAddFinance}
                className="sm:col-span-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Lưu
              </button>
            </div>

            <div className="space-y-2">
              {finances.map((f) => {
                const isEditing = editingFinId === f.id;
                return (
                  <div
                    key={f.id}
                    className="rounded-xl border border-fb-divider px-3 py-2.5 text-xs"
                  >
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <select
                          value={editFinDraft.type || f.type}
                          onChange={(e) =>
                            setEditFinDraft((d) => ({ ...d, type: e.target.value as 'thu' | 'chi' }))
                          }
                          className="sm:col-span-2 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider font-bold"
                        >
                          <option value="thu">Thu</option>
                          <option value="chi">Chi</option>
                        </select>
                        <input
                          type="text"
                          value={editFinDraft.title ?? f.title}
                          onChange={(e) => setEditFinDraft((d) => ({ ...d, title: e.target.value }))}
                          className="sm:col-span-4 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider"
                        />
                        <input
                          type="number"
                          value={editFinDraft.amount ?? f.amount}
                          onChange={(e) =>
                            setEditFinDraft((d) => ({ ...d, amount: Number(e.target.value) }))
                          }
                          className="sm:col-span-2 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider"
                        />
                        <input
                          type="text"
                          value={editFinDraft.debt_note ?? f.debt_note}
                          onChange={(e) =>
                            setEditFinDraft((d) => ({ ...d, debt_note: e.target.value }))
                          }
                          placeholder="Công nợ..."
                          className="sm:col-span-2 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider"
                        />
                        <div className="sm:col-span-2 flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveFinance(f.id)}
                            className="rounded-lg bg-emerald-600 text-white p-1.5 cursor-pointer"
                            title="Lưu sửa"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFinId(null)}
                            className="rounded-lg bg-slate-200 text-slate-700 p-1.5 cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-fb-text">{f.title}</div>
                          <div className="text-[11px] text-fb-muted">
                            {f.record_date} {f.debt_note ? `• ${f.debt_note}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`font-extrabold ${
                              f.type === 'thu' ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {f.type === 'thu' ? '+' : '-'}
                            {Number(f.amount).toLocaleString('vi-VN')} đ
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFinId(f.id);
                              setEditFinDraft(f);
                            }}
                            className="text-fb-muted hover:text-emerald-700 cursor-pointer"
                            title="Sửa phiếu"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFinance(f.id)}
                            className="text-fb-muted hover:text-red-600 cursor-pointer"
                            title="Xóa phiếu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. V-ARGON OFFICE — AGENT TỔNG HỢP CUỐI NGÀY */}
        {tab === 'office' && (() => {
          const CATEGORY_META: Record<string, { label: string; badge: string }> = {
            tong_ket: { label: 'Tổng kết ngày', badge: 'bg-purple-100 text-purple-800' },
            thu_chi: { label: 'Thu chi', badge: 'bg-emerald-100 text-emerald-800' },
            xuat_nhap_kho: { label: 'Xuất nhập kho', badge: 'bg-sky-100 text-sky-800' },
            xuat_chuong: { label: 'Xuất chuồng', badge: 'bg-amber-100 text-amber-800' },
            thu_hoach: { label: 'Thu hoạch', badge: 'bg-lime-100 text-lime-800' },
            nhan_su_khoan: { label: 'Nhân sự & Khoán', badge: 'bg-indigo-100 text-indigo-800' },
            thong_bao: { label: 'Thông báo', badge: 'bg-rose-100 text-rose-800' },
            nhat_ky_vat_nuoi: { label: 'Nhật ký vật nuôi', badge: 'bg-orange-100 text-orange-800' },
            nhat_ky_tang_truong: { label: 'Nhật ký tăng trưởng', badge: 'bg-teal-100 text-teal-800' },
          };

          const formatHour = (r: OfficeRecord) => {
            if (r.hour_slot) return r.hour_slot;
            if (r.timestampt) {
              try {
                return new Date(r.timestampt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {}
            }
            return '--:--';
          };

          const eodRow = officeRows.find((r) => r.category === 'tong_ket');
          const thuCount = officeRows.filter((r) => r.category === 'thu_chi').length;
          const khoCount = officeRows.filter((r) => r.category === 'xuat_nhap_kho').length;
          const xuatChuongCount = officeRows.filter((r) => r.category === 'xuat_chuong').length;
          const thuHoachCount = officeRows.filter((r) => r.category === 'thu_hoach').length;
          const nhanSuCount = officeRows.filter((r) => r.category === 'nhan_su_khoan').length;
          const thongBaoCount = officeRows.filter((r) => r.category === 'thong_bao').length;
          const vatNuoiCount = officeRows.filter((r) => r.category === 'nhat_ky_vat_nuoi').length;
          const tangTruongCount = officeRows.filter((r) => r.category === 'nhat_ky_tang_truong').length;

          return (
            <div className="space-y-4">
              {/* Header & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs sm:text-sm font-extrabold text-fb-text">
                      V-Argon Office — Agent Tổng Hợp Cuối Ngày
                    </span>
                  </div>
                  <p className="text-[11px] text-fb-muted mt-0.5">
                    Tự động tổng hợp Thu chi, Xuất nhập kho, Xuất chuồng, Thu hoạch &amp; Nhân sự/Khoán (tự cộng tiền công khi hết ngày) theo giờ (cột{' '}
                    <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">timestampt</code>) lúc 21:00 hoặc bấm chạy ngay.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 bg-fb-bg border border-fb-divider rounded-xl px-2.5 py-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-fb-muted" />
                    <input
                      type="date"
                      value={officeDate}
                      onChange={(e) => setOfficeDate(e.target.value)}
                      className="bg-transparent text-xs font-semibold outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleTriggerOfficeSummary}
                    disabled={isSummarizingOffice}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-3 py-1.5 text-[11px] font-bold text-white transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSummarizingOffice ? 'animate-spin' : ''}`} />
                    <span>{isSummarizingOffice ? 'Agent đang tổng hợp...' : 'Tổng hợp cuối ngày ngay'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportTableToExcel(
                        `v-argon-office-${officeDate || new Date().toISOString().slice(0, 10)}`,
                        'V-Argon Office',
                        ['Giờ (timestampt)', 'Phân loại', 'Mã', 'Nội dung', 'Số lượng / Giá trị', 'Đơn vị', 'Trạng thái', 'Ghi chú'],
                        officeRows.map((r) => [
                          r.timestampt || formatHour(r),
                          CATEGORY_META[r.category || '']?.label || r.category || '',
                          r.code,
                          r.item,
                          String(r.quantity_or_amount ?? 0),
                          r.unit || '',
                          r.status,
                          r.note,
                        ])
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Xuất Excel Office</span>
                  </button>
                </div>
              </div>

              {officeSummaryMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{officeSummaryMsg}</span>
                </div>
              )}

              {/* AI End-of-Day Summary Banner */}
              {eodRow && (
                <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/80 to-emerald-50/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-900">
                      <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                      {eodRow.item}
                    </span>
                    <span className="text-[10px] font-bold text-purple-700">
                      Cập nhật lúc {formatHour(eodRow)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{eodRow.note}</p>
                </div>
              )}

              {/* KPI Strip + Category Filter */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: `Tất cả (${officeRows.length})` },
                    { id: 'thu_chi', label: `Thu chi (${thuCount})` },
                    { id: 'xuat_nhap_kho', label: `Xuất nhập kho (${khoCount})` },
                    { id: 'xuat_chuong', label: `Xuất chuồng (${xuatChuongCount})` },
                    { id: 'thu_hoach', label: `Thu hoạch (${thuHoachCount})` },
                    { id: 'nhan_su_khoan', label: `Nhân sự & Khoán (${nhanSuCount})` },
                    { id: 'thong_bao', label: `Thông báo (${thongBaoCount})` },
                    { id: 'nhat_ky_vat_nuoi', label: `Nhật ký vật nuôi (${vatNuoiCount})` },
                    { id: 'nhat_ky_tang_truong', label: `Nhật ký tăng trưởng (${tangTruongCount})` },
                    { id: 'tong_ket', label: 'Tổng kết' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOfficeCategory(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        officeCategory === f.id
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-fb-muted hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Add Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={newRowCategory}
                  onChange={(e) => setNewRowCategory(e.target.value)}
                  className="sm:col-span-2 bg-fb-bg text-xs rounded-xl px-2.5 py-2 border border-fb-divider"
                >
                  <option value="thu_chi">Thu chi</option>
                  <option value="xuat_nhap_kho">Xuất nhập kho</option>
                  <option value="xuat_chuong">Xuất chuồng</option>
                  <option value="thu_hoach">Thu hoạch</option>
                  <option value="nhan_su_khoan">Nhân sự &amp; Khoán</option>
                  <option value="thong_bao">Thông báo</option>
                  <option value="nhat_ky_vat_nuoi">Nhật ký vật nuôi</option>
                  <option value="nhat_ky_tang_truong">Nhật ký tăng trưởng</option>
                </select>
                <input
                  type="text"
                  value={newRowCode}
                  onChange={(e) => setNewRowCode(e.target.value)}
                  placeholder="Mã (vd: LO-02)"
                  className="sm:col-span-2 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
                />
                <input
                  type="text"
                  value={newRowItem}
                  onChange={(e) => setNewRowItem(e.target.value)}
                  placeholder="Nội dung bản ghi..."
                  className="sm:col-span-3 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
                />
                <input
                  type="number"
                  value={newRowAmount}
                  onChange={(e) => setNewRowAmount(e.target.value)}
                  placeholder="Số lượng / Tiền"
                  className="sm:col-span-2 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
                />
                <input
                  type="text"
                  value={newRowNote}
                  onChange={(e) => setNewRowNote(e.target.value)}
                  placeholder="Ghi chú..."
                  className="sm:col-span-2 bg-fb-bg text-xs rounded-xl px-3 py-2 border border-fb-divider"
                />
                <button
                  type="button"
                  onClick={handleAddOffice}
                  className="sm:col-span-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Thêm
                </button>
              </div>

              {/* Office Table */}
              <div className="overflow-x-auto rounded-xl border border-fb-divider">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-fb-muted font-bold border-b border-fb-divider">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">Giờ (timestampt)</th>
                      <th className="px-3 py-2 whitespace-nowrap">Phân loại</th>
                      <th className="px-3 py-2">Mã</th>
                      <th className="px-3 py-2">Nội dung</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">SL / Giá trị</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2">Ghi chú</th>
                      <th className="px-3 py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fb-divider">
                    {officeRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-xs text-fb-muted">
                          Chưa có dữ liệu tổng hợp cho ngày {officeDate}. Hãy bấm{' '}
                          <strong>&ldquo;Tổng hợp cuối ngày ngay&rdquo;</strong> để Agent quét Thu chi, Kho, Xuất chuồng &amp; Thu hoạch.
                        </td>
                      </tr>
                    ) : (
                      officeRows.map((r) => {
                        const isEditing = editingOfficeId === r.id;
                        const catMeta = CATEGORY_META[r.category || ''] || {
                          label: r.category || 'Khác',
                          badge: 'bg-slate-100 text-slate-700',
                        };
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2 whitespace-nowrap text-fb-muted" title={r.timestampt || ''}>
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700">
                                <Clock className="w-3 h-3 text-emerald-600" />
                                {formatHour(r)}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catMeta.badge}`}>
                                {catMeta.label}
                              </span>
                            </td>
                            {isEditing ? (
                              <>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editOfficeDraft.code ?? r.code}
                                    onChange={(e) =>
                                      setEditOfficeDraft((d) => ({ ...d, code: e.target.value }))
                                    }
                                    className="w-20 bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editOfficeDraft.item ?? r.item}
                                    onChange={(e) =>
                                      setEditOfficeDraft((d) => ({ ...d, item: e.target.value }))
                                    }
                                    className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    value={editOfficeDraft.quantity_or_amount ?? r.quantity_or_amount ?? 0}
                                    onChange={(e) =>
                                      setEditOfficeDraft((d) => ({
                                        ...d,
                                        quantity_or_amount: Number(e.target.value),
                                      }))
                                    }
                                    className="w-24 bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider text-right"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editOfficeDraft.status ?? r.status}
                                    onChange={(e) =>
                                      setEditOfficeDraft((d) => ({ ...d, status: e.target.value }))
                                    }
                                    className="w-24 bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editOfficeDraft.note ?? r.note}
                                    onChange={(e) =>
                                      setEditOfficeDraft((d) => ({ ...d, note: e.target.value }))
                                    }
                                    className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveOffice(r.id)}
                                    className="inline-flex rounded-lg bg-emerald-600 text-white p-1 mr-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingOfficeId(null)}
                                    className="inline-flex rounded-lg bg-slate-200 text-slate-700 p-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 font-bold text-emerald-700 whitespace-nowrap">{r.code}</td>
                                <td className="px-3 py-2 font-semibold">{r.item}</td>
                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                                  {Number(r.quantity_or_amount || 0).toLocaleString('vi-VN')} {r.unit || ''}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                    {r.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-fb-muted max-w-xs">{r.note}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOfficeId(r.id);
                                      setEditOfficeDraft(r);
                                    }}
                                    className="text-fb-muted hover:text-emerald-700 mr-2 cursor-pointer"
                                    title="Sửa"
                                  >
                                    <Pencil className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOffice(r.id)}
                                    className="text-fb-muted hover:text-red-600 cursor-pointer"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* 3. NHÂN SỰ & KHOÁN (FULL CRUD) */}
        {tab === 'hr' && (
          <div className="space-y-4">
            {/* Bảng Nhân sự & Tiền công ngày (từ bảng staff) */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-indigo-950">
                    Bảng Nhân Sự, Tiền Công Ngày &amp; Ghi Công (Đọc từ DB <code className="px-1 bg-white rounded">staff</code>)
                  </h4>
                  <p className="text-[11px] text-indigo-800/80">
                    Thiết lập mức tiền công 1 ngày, ghi số ngày công bên cạnh để tự tính thành tiền và xuất file Excel.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportStaffPayrollExcel}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Xuất Excel Công &amp; Lương</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadStaffWages}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Làm mới</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-indigo-50/70 text-indigo-900 font-bold border-b border-indigo-100">
                    <tr>
                      <th className="px-3 py-2">Mã NV</th>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Chức vụ</th>
                      <th className="px-3 py-2">Điểm danh hôm nay</th>
                      <th className="px-3 py-2">Tiền công / ngày (VNĐ)</th>
                      <th className="px-3 py-2">Ghi công (ngày)</th>
                      <th className="px-3 py-2 text-right">Thành tiền</th>
                      <th className="px-3 py-2 text-right">Lưu công</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {staffWages.map((st) => {
                      const logs = todayAttLogs.filter((l) => l.staff_id === st.id);
                      const hasOut = logs.some((l) => l.check_type === 'check_out');
                      const hasIn = logs.length > 0;
                      const attBadge = hasOut
                        ? { text: 'Đủ công (đã tan ca)', cls: 'bg-emerald-100 text-emerald-800' }
                        : hasIn
                        ? { text: 'Đang trong ca', cls: 'bg-amber-100 text-amber-800' }
                        : { text: 'Chưa điểm danh', cls: 'bg-slate-100 text-slate-600' };
                      const dailyWageNum = Number(wageDrafts[st.id] ?? st.daily_wage ?? 300000) || 0;
                      const workDays = Number(workDaysDrafts[st.id] ?? 0) || 0;
                      const totalPay = Math.round(dailyWageNum * workDays);

                      return (
                        <tr key={st.id}>
                          <td className="px-3 py-2 font-bold text-indigo-700">{st.id}</td>
                          <td className="px-3 py-2 font-semibold">{st.name}</td>
                          <td className="px-3 py-2 text-fb-muted">{st.role || 'Nhân viên'}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attBadge.cls}`}>
                              {attBadge.text}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={wageDrafts[st.id] ?? String(st.daily_wage ?? 300000)}
                              onChange={(e) =>
                                setWageDrafts((prev) => ({ ...prev, [st.id]: e.target.value }))
                              }
                              className="w-28 bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider text-xs font-bold text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setStaffWorkDays(st.id, workDays - 0.5)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={workDays}
                                onChange={(e) => setStaffWorkDays(st.id, Number(e.target.value) || 0)}
                                className="w-16 bg-fb-bg rounded-lg px-1.5 py-1 border border-fb-divider text-xs font-bold text-center"
                              />
                              <button
                                type="button"
                                onClick={() => setStaffWorkDays(st.id, workDays + 1)}
                                className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 font-bold text-emerald-800 cursor-pointer"
                              >
                                +1
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                            {totalPay.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleSaveStaffWage(st.id)}
                              disabled={savingWageId === st.id}
                              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                            >
                              {savingWageId === st.id ? '...' : 'Lưu'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {staffWages.length > 0 && (
                    <tfoot className="bg-indigo-50/50 border-t border-indigo-100 font-extrabold text-indigo-950">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right">Tổng cộng:</td>
                        <td className="px-3 py-2 text-center">
                          {staffWages.reduce((s, st) => s + (Number(workDaysDrafts[st.id] ?? 0) || 0), 0)} ngày
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700 whitespace-nowrap">
                          {staffWages
                            .reduce((s, st) => {
                              const w = Number(wageDrafts[st.id] ?? st.daily_wage ?? 300000) || 0;
                              const d = Number(workDaysDrafts[st.id] ?? 0) || 0;
                              return s + Math.round(w * d);
                            }, 0)
                            .toLocaleString('vi-VN')}{' '}
                          đ
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-fb-text">
                Quản lý Nghỉ Phép &amp; Định Mức Giao Khoán
              </span>
              <button
                type="button"
                onClick={() =>
                  exportTableToExcel(
                    `nhan-su-khoan-${new Date().toISOString().slice(0, 10)}`,
                    'Nhân sự & Khoán',
                    ['Hạng mục', 'Nhân viên', 'Chi tiết', 'Trạng thái / Tiến độ'],
                    [
                      ...leaves.map((l) => [
                        'Đơn nghỉ phép',
                        l.staff_name,
                        `${l.leave_date} - ${l.reason}`,
                        l.status === 'approved' ? 'Đã duyệt' : l.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
                      ]),
                      ...quotas.map((q) => [
                        'Giao khoán',
                        q.staff_name,
                        q.task_title,
                        `${q.completed_qty}/${q.target_qty} ${q.unit}`,
                      ]),
                    ]
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Excel Nhân Sự</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Đơn xin nghỉ phép */}
              <div className="rounded-xl border border-fb-divider p-3.5 space-y-2.5">
                <div className="font-extrabold text-fb-text">Đơn xin nghỉ phép</div>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="text"
                    value={leaveStaff}
                    onChange={(e) => setLeaveStaff(e.target.value)}
                    placeholder="Tên nhân viên..."
                    className="flex-1 min-w-[110px] bg-fb-bg rounded-lg px-2.5 py-1.5 border border-fb-divider"
                  />
                  <input
                    type="text"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    placeholder="Ngày nghỉ"
                    className="w-24 bg-fb-bg rounded-lg px-2.5 py-1.5 border border-fb-divider"
                  />
                  <input
                    type="text"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Lý do..."
                    className="flex-1 min-w-[110px] bg-fb-bg rounded-lg px-2.5 py-1.5 border border-fb-divider"
                  />
                  <button
                    type="button"
                    onClick={handleAddLeave}
                    className="rounded-lg bg-emerald-700 text-white px-2.5 py-1.5 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {leaves.map((l) => (
                  <div
                    key={l.id}
                    className={`rounded-lg border p-2.5 flex items-center justify-between gap-2 ${
                      l.status === 'approved'
                        ? 'bg-emerald-50 border-emerald-200'
                        : l.status === 'rejected'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold">
                        {l.staff_name} — {l.leave_date}
                      </div>
                      <div className="text-[11px] text-fb-muted">Lý do: {l.reason}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {l.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateLeaveStatus(l.id, 'approved')}
                            className="rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLeaveStatus(l.id, 'rejected')}
                            className="rounded-md bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                          >
                            Từ chối
                          </button>
                        </>
                      ) : (
                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold">
                          {l.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteLeave(l.id)}
                        className="text-fb-muted hover:text-red-600 p-0.5 cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Định mức giao khoán */}
              <div className="rounded-xl border border-fb-divider p-3.5 space-y-2.5">
                <div className="font-extrabold text-fb-text">Định mức giao khoán công việc</div>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="text"
                    value={quotaStaff}
                    onChange={(e) => setQuotaStaff(e.target.value)}
                    placeholder="Nhân viên..."
                    className="flex-1 min-w-[100px] bg-fb-bg rounded-lg px-2.5 py-1.5 border border-fb-divider"
                  />
                  <input
                    type="text"
                    value={quotaTask}
                    onChange={(e) => setQuotaTask(e.target.value)}
                    placeholder="Công việc..."
                    className="flex-1 min-w-[110px] bg-fb-bg rounded-lg px-2.5 py-1.5 border border-fb-divider"
                  />
                  <input
                    type="number"
                    value={quotaTarget}
                    onChange={(e) => setQuotaTarget(e.target.value)}
                    placeholder="Định mức"
                    className="w-20 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider"
                  />
                  <input
                    type="text"
                    value={quotaUnit}
                    onChange={(e) => setQuotaUnit(e.target.value)}
                    placeholder="ĐVT"
                    className="w-14 bg-fb-bg rounded-lg px-2 py-1.5 border border-fb-divider"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuota}
                    className="rounded-lg bg-emerald-700 text-white px-2.5 py-1.5 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {quotas.map((q) => {
                    const pct = q.target_qty > 0 ? Math.round((q.completed_qty / q.target_qty) * 100) : 0;
                    const step = Math.max(1, Math.round(q.target_qty * 0.1));
                    return (
                      <div key={q.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 font-semibold">
                          <span>
                            {q.staff_name} — {q.task_title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-700">
                              {q.completed_qty}/{q.target_qty} {q.unit} ({pct}%)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuotaProgress(q, step)}
                              className="rounded bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 cursor-pointer"
                              title="Cập nhật thêm tiến độ"
                            >
                              +{step}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuota(q.id)}
                              className="text-fb-muted hover:text-red-600 cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. QR VIDEO SẢN XUẤT SẢN PHẨM (FULL CRUD) */}
        {tab === 'qr' && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold text-fb-text flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  <span>Tạo Mã QR Truy Cập Nhanh Cây Trồng</span>
                </span>
                <p className="text-[11px] text-fb-muted mt-0.5">
                  Chọn cây trồng bất kỳ để tạo mã QR; khi quét mã sẽ mở thẳng thông tin cây trồng đó.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportTableToExcel(
                    `qr-cay-trong-${new Date().toISOString().slice(0, 10)}`,
                    'QR Cây Trồng',
                    ['Mã cây', 'Tên cây trồng', 'Link truy cập nhanh', 'Ghi chú'],
                    videoQrs.map((q) => [q.lot_code, q.product_name, q.video_url, q.note])
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Excel QR</span>
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-fb-divider p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedQrCropId}
                  onChange={(e) => setSelectedQrCropId(e.target.value)}
                  className="bg-white rounded-xl px-3 py-2 border border-fb-divider font-semibold text-slate-800"
                >
                  {cropsList.length === 0 ? (
                    <option value="">-- Chưa có cây trồng trong DB --</option>
                  ) : (
                    cropsList.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        🌱 {c.name} (ID #{c.id}{c.pen_id ? ` • Khu ${c.pen_id}` : ''})
                      </option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  value={qrNote}
                  onChange={(e) => setQrNote(e.target.value)}
                  placeholder="Ghi chú thêm (tùy chọn)..."
                  className="bg-white rounded-xl px-3 py-2 border border-fb-divider"
                />
              </div>
              <button
                type="button"
                onClick={handleAddQr}
                disabled={!selectedQrCropId}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-4 py-2 font-bold text-white transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Tạo mã QR cây trồng</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {videoQrs.map((item) => {
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  item.video_url
                )}`;
                const isEditing = editingQrId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-fb-divider bg-white p-3.5 flex items-start gap-3.5"
                  >
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <img
                        src={qrImgUrl}
                        alt={`Mã QR video ${item.product_name}`}
                        className="h-24 w-24 rounded-lg border border-fb-divider bg-white p-1 object-contain"
                      />
                      <span className="text-[10px] font-extrabold text-emerald-800">
                        {item.lot_code}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={editQrDraft.product_name ?? item.product_name}
                            onChange={(e) =>
                              setEditQrDraft((d) => ({ ...d, product_name: e.target.value }))
                            }
                            className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider font-bold"
                          />
                          <input
                            type="text"
                            value={editQrDraft.lot_code ?? item.lot_code}
                            onChange={(e) =>
                              setEditQrDraft((d) => ({ ...d, lot_code: e.target.value }))
                            }
                            className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                          />
                          <input
                            type="url"
                            value={editQrDraft.video_url ?? item.video_url}
                            onChange={(e) =>
                              setEditQrDraft((d) => ({ ...d, video_url: e.target.value }))
                            }
                            className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                          />
                          <input
                            type="text"
                            value={editQrDraft.note ?? item.note}
                            onChange={(e) =>
                              setEditQrDraft((d) => ({ ...d, note: e.target.value }))
                            }
                            className="w-full bg-fb-bg rounded-lg px-2 py-1 border border-fb-divider"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveQr(item.id)}
                              className="rounded-lg bg-emerald-600 text-white px-2.5 py-1 font-bold cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingQrId(null)}
                              className="rounded-lg bg-slate-200 text-slate-700 px-2.5 py-1 font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-extrabold text-fb-text leading-snug">
                              {item.product_name}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQrId(item.id);
                                  setEditQrDraft(item);
                                }}
                                className="text-fb-muted hover:text-emerald-700 cursor-pointer"
                                title="Sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQr(item.id)}
                                className="text-fb-muted hover:text-red-600 cursor-pointer"
                                title="Xóa mã QR này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-fb-muted leading-relaxed">{item.note}</p>
                          <div className="text-[10px] text-blue-600 truncate">{item.video_url}</div>

                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const m = String(item.video_url || '').match(/crop_id=([^&]+)/);
                                const pm = String(item.video_url || '').match(/pen_id=([^&]+)/);
                                if (m && onQuickAccessCrop) {
                                  onQuickAccessCrop(decodeURIComponent(m[1]), pm ? decodeURIComponent(pm[1]) : undefined);
                                } else if (item.video_url) {
                                  window.open(item.video_url, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Truy cập nhanh</span>
                            </button>
                            <a
                              href={qrImgUrl}
                              download={`${item.lot_code}-qr.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-fb-text"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>Mở ảnh QR</span>
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
