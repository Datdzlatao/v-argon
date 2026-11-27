'use client';

import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Package,
  RefreshCw,
  HeartPulse,
  Scale,
  Sprout,
  Droplets,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  penId: string;
  penName: string;
  penType?: string;
  pens: Array<{ id: string; name: string; type?: string }>;
  onRefreshParent?: () => void;
}

export default function IosFarmOperations({
  penId,
  penName,
  penType,
  pens,
  onRefreshParent,
}: Props) {
  const isCultivation = (penType || '').toLowerCase().includes('cultivat') || (penType || '').toLowerCase().includes('crop') || penName.toLowerCase().includes('vườn') || penName.toLowerCase().includes('màng');
  const [section, setSection] = useState<'livestock_crops' | 'inventory'>('livestock_crops');
  const [loading, setLoading] = useState(false);

  // Animals & Crops
  const [animals, setAnimals] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);

  // Add Animal / Crop form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSub, setNewSub] = useState('');
  const [newQtyOrWeight, setNewQtyOrWeight] = useState('');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'attention' | 'healthy'>('all');
  const [showExportHistory, setShowExportHistory] = useState(false);

  // Quick action modal-like inline state + existing logs
  const [activeLogTarget, setActiveLogTarget] = useState<{
    kind: 'weight' | 'health' | 'transfer' | 'growth' | 'care';
    id: string;
    label: string;
  } | null>(null);
  const [existingLogs, setExistingLogs] = useState<any[]>([]);
  const [logInput1, setLogInput1] = useState('');
  const [logInput2, setLogInput2] = useState('');

  // Inventory
  const [inventory, setInventory] = useState<any[]>([]);
  const [invLogs, setInvLogs] = useState<any[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invCatFilter, setInvCatFilter] = useState('All');
  const [logActionFilter, setLogActionFilter] = useState('ALL');
  const [invFormMode, setInvFormMode] = useState<'none' | 'import' | 'export'>('none');
  const [invCat, setInvCat] = useState('Feed');
  const [invName, setInvName] = useState('');
  const [invQty, setInvQty] = useState('');
  const [invUnit, setInvUnit] = useState('kg');
  const [invPrice, setInvPrice] = useState('');
  const [exportItemId, setExportItemId] = useState('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: anis }, { data: crps }, { data: inv }, { data: logs }] = await Promise.all([
        penId
          ? supabase.from('animals').select('*').eq('pen_id', penId).order('id')
          : supabase.from('animals').select('*').order('id'),
        penId
          ? supabase.from('crops').select('*').eq('pen_id', penId).order('id')
          : supabase.from('crops').select('*').order('id'),
        supabase.from('inventory').select('*').order('category'),
        supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(15),
      ]);
      setAnimals(anis || []);
      setCrops(crps || []);
      setInventory(inv || []);
      setInvLogs(logs || []);
      if (inv && inv.length > 0 && !exportItemId) {
        setExportItemId(String(inv[0].id));
      }
    } catch {
      // ignore offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penId]);

  const handleAddAnimalOrCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !penId) return;
    if (isCultivation) {
      await fetch(`${backendUrl}/api/crops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          variety: newSub.trim() || 'Giống tiêu chuẩn',
          quantity: Number(newQtyOrWeight) || 100,
          pen_id: penId,
        }),
      }).catch(async () => {
        await supabase.from('crops').insert([{
          id: `CROP-${Date.now().toString().slice(-4)}`,
          name: newName.trim(),
          variety: newSub.trim() || 'Giống tiêu chuẩn',
          quantity: Number(newQtyOrWeight) || 100,
          pen_id: penId,
          status: 'Growing',
        }]);
      });
    } else {
      await fetch(`${backendUrl}/api/animals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `ANI-${Date.now().toString().slice(-4)}`,
          species: newName.trim(),
          breed: newSub.trim() || 'Tiêu chuẩn',
          weight: Number(newQtyOrWeight) || 25,
          pen_id: penId,
          status: 'Healthy',
        }),
      }).catch(async () => {
        await supabase.from('animals').insert([{
          id: `ANI-${Date.now().toString().slice(-4)}`,
          species: newName.trim(),
          breed: newSub.trim() || 'Tiêu chuẩn',
          weight: Number(newQtyOrWeight) || 25,
          pen_id: penId,
          status: 'Healthy',
        }]);
      });
    }
    setNewName('');
    setNewSub('');
    setNewQtyOrWeight('');
    setShowAddForm(false);
    await loadData();
    onRefreshParent?.();
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLogTarget) return;
    const { kind, id } = activeLogTarget;
    if (kind === 'weight') {
      const w = Number(logInput1);
      if (w > 0) {
        await supabase.from('weight_logs').insert([{ animal_id: id, weight: w }]);
        await supabase.from('animals').update({ weight: w }).eq('id', id);
      }
    } else if (kind === 'health') {
      await fetch(`${backendUrl}/api/animals/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animal_id: id,
          status: logInput1 || 'Healthy',
          note: logInput2 || 'Cập nhật từ PWA iOS',
        }),
      });
    } else if (kind === 'transfer') {
      if (logInput1) {
        await fetch(`${backendUrl}/api/animals/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animal_id: id, target_pen_id: logInput1 }),
        });
      }
    } else if (kind === 'growth') {
      await fetch(`${backendUrl}/api/crops/${encodeURIComponent(id)}/growth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height_cm: Number(logInput1) || 0,
          note: logInput2 || 'Đo sinh trưởng từ PWA iOS',
        }),
      });
    } else if (kind === 'care') {
      await fetch(`${backendUrl}/api/crops/${encodeURIComponent(id)}/care`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: logInput1 || 'Tưới nước & Bón phân',
          note: logInput2 || 'Chăm sóc từ PWA iOS',
        }),
      });
    }
    setActiveLogTarget(null);
    setLogInput1('');
    setLogInput2('');
    await loadData();
    onRefreshParent?.();
  };

  const handleDeleteAnimal = async (id: string) => {
    if (!confirm(`Xóa hồ sơ cá thể ${id}?`)) return;
    await supabase.from('animals').delete().eq('id', id);
    await loadData();
    onRefreshParent?.();
  };

  const handleDeleteCrop = async (id: string) => {
    if (!confirm('Xóa vụ mùa cây trồng này?')) return;
    await supabase.from('crops').delete().eq('id', id);
    await loadData();
    onRefreshParent?.();
  };

  const openLogPanel = async (kind: 'weight' | 'health' | 'transfer' | 'growth' | 'care', id: string, label: string, defaultInput = '') => {
    setActiveLogTarget({ kind, id, label });
    setLogInput1(defaultInput);
    setLogInput2('');
    setExistingLogs([]);
    const tableMap: Record<string, { table: string; col: string }> = {
      weight: { table: 'weight_logs', col: 'animal_id' },
      health: { table: 'health_logs', col: 'animal_id' },
      growth: { table: 'crop_growth_logs', col: 'crop_id' },
      care: { table: 'crop_care_logs', col: 'crop_id' },
    };
    const cfg = tableMap[kind];
    if (cfg) {
      const { data } = await supabase.from(cfg.table).select('*').eq(cfg.col, id).order('created_at', { ascending: false }).limit(10);
      setExistingLogs(data || []);
    }
  };

  const handleDeleteLogItem = async (logId: any) => {
    if (!activeLogTarget || !logId) return;
    const tableMap: Record<string, string> = {
      weight: 'weight_logs',
      health: 'health_logs',
      growth: 'crop_growth_logs',
      care: 'crop_care_logs',
    };
    const tbl = tableMap[activeLogTarget.kind];
    if (!tbl) return;
    await supabase.from(tbl).delete().eq('id', logId);
    setExistingLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
  };

  const handleHarvestAnimal = async (a: any) => {
    if (!confirm(`XÁC NHẬN XUẤT CHUỒNG: ${a.id} (${a.species}, ${a.weight ?? 0} kg)?`)) return;
    await supabase.from('animals').delete().eq('id', a.id);
    await supabase.from('inventory_logs').insert([{
      action_type: 'ANIMAL_EXPORT',
      item_name: `${a.id} (${a.species})`,
      quantity: Number(a.weight || 0),
      unit: 'kg',
      pen_id: penId || null,
      note: `Xuất chuồng cá thể ${a.id} (${a.weight || 0} kg)`,
    }]);
    await loadData();
    onRefreshParent?.();
  };

  const handleHarvestCrop = async (c: any) => {
    if (!confirm(`XÁC NHẬN THU HOẠCH: ${c.name} (${c.quantity ?? 0} cây)?`)) return;
    await supabase.from('crops').delete().eq('id', c.id);
    await supabase.from('inventory_logs').insert([{
      action_type: 'CROP_HARVEST',
      item_name: `${c.name}`,
      quantity: Number(c.quantity || 0),
      unit: 'cây',
      pen_id: penId || null,
      note: `Thu hoạch vụ mùa ${c.name} (${c.quantity || 0} cây)`,
    }]);
    await loadData();
    onRefreshParent?.();
  };

  const exportCsv = (filename: string, headers: string[], rows: any[][]) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(invQty);
    if (!invName.trim() || !(qty > 0)) return;
    const existing = inventory.find(
      (i) => String(i.name).toLowerCase() === invName.trim().toLowerCase()
    );
    if (existing) {
      await supabase
        .from('inventory')
        .update({
          quantity: Number(existing.quantity || 0) + qty,
          unit_price: Number(invPrice) || existing.unit_price || 0,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('inventory').insert([{
        category: invCat,
        name: invName.trim(),
        quantity: qty,
        unit: invUnit.trim() || 'kg',
        unit_price: Number(invPrice) || 0,
      }]);
    }
    await supabase.from('inventory_logs').insert([{
      action_type: 'IMPORT',
      item_name: invName.trim(),
      quantity: qty,
      unit: invUnit.trim() || 'kg',
      note: `Nhập kho PWA (${Number(invPrice || 0).toLocaleString('vi-VN')} đ)`,
    }]);
    setInvName('');
    setInvQty('');
    setInvPrice('');
    setInvFormMode('none');
    await loadData();
  };

  const handleExportInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(invQty);
    const target = inventory.find((i) => String(i.id) === exportItemId);
    if (!target || !(qty > 0)) return;
    const nextQty = Math.max(0, Number(target.quantity || 0) - qty);
    await supabase.from('inventory').update({ quantity: nextQty }).eq('id', target.id);
    await supabase.from('inventory_logs').insert([{
      action_type: 'EXPORT',
      item_name: target.name,
      quantity: qty,
      unit: target.unit || 'kg',
      pen_id: penId || null,
      note: `Xuất cho ${penName || 'trang trại'}`,
    }]);
    setInvQty('');
    setInvFormMode('none');
    await loadData();
  };

  return (
    <div className="space-y-3">
      {/* Sub-switcher: Đàn/Vườn vs Kho */}
      <div className="bg-black/[0.06] p-1 rounded-xl grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setSection('livestock_crops')}
          className={`py-1.5 rounded-lg text-[12px] font-bold transition ${
            section === 'livestock_crops' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          {isCultivation ? '🌱 Cây trồng' : '🐖 Vật nuôi'}
        </button>
        <button
          type="button"
          onClick={() => setSection('inventory')}
          className={`py-1.5 rounded-lg text-[12px] font-bold transition ${
            section === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          📦 Kho vật tư
        </button>
      </div>

      {section === 'livestock_crops' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-600">
              {penName || 'Khu vực'} ({isCultivation ? crops.length : animals.length})
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowExportHistory((v) => !v)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold ${
                  showExportHistory ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Lịch sử xuất
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isCultivation) {
                    exportCsv('cay-trong', ['Tên', 'Giống', 'Số lượng', 'Trạng thái'], crops.map((c) => [c.name, c.variety, c.quantity, c.status]));
                  } else {
                    exportCsv('vat-nuoi', ['Mã', 'Loài', 'Giống', 'Cân nặng', 'Trạng thái'], animals.map((a) => [a.id, a.species, a.breed, a.weight, a.status]));
                  }
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-100 text-emerald-700 text-[11px] font-bold"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={loadData}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-700"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                {isCultivation ? 'Thêm' : 'Thêm'}
              </button>
            </div>
          </div>

          {showExportHistory && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-amber-900">
                  Lịch sử xuất chuồng / thu hoạch
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const ex = invLogs.filter((l) => l.action_type === 'ANIMAL_EXPORT' || l.action_type === 'CROP_HARVEST');
                    exportCsv('lich-su-xuat-ban', ['Loại', 'Tên', 'Số lượng', 'Đơn vị', 'Ghi chú'], ex.map((l) => [l.action_type, l.item_name, l.quantity, l.unit || '', l.note || '']));
                  }}
                  className="text-[11px] font-bold text-emerald-700"
                >
                  Xuất CSV
                </button>
              </div>
              {invLogs.filter((l) => l.action_type === 'ANIMAL_EXPORT' || l.action_type === 'CROP_HARVEST').length === 0 ? (
                <p className="text-[11px] text-amber-700">Chưa có lịch sử xuất bán.</p>
              ) : (
                invLogs
                  .filter((l) => l.action_type === 'ANIMAL_EXPORT' || l.action_type === 'CROP_HARVEST')
                  .map((l, idx) => (
                    <div key={l.id || idx} className="text-[11px] bg-white rounded-lg px-2.5 py-1.5 flex justify-between">
                      <span className="font-semibold text-slate-800">{l.item_name}</span>
                      <span className="text-emerald-700 font-bold">{l.quantity} {l.unit}</span>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* Search & Status Filter */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isCultivation ? 'Tìm cây trồng...' : 'Tìm mã thẻ / loài...'}
              className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-black/5 text-[12px] outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-black/5 text-[12px] outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="healthy">Khỏe mạnh</option>
              <option value="attention">Cần chú ý</option>
              <option value="ready">Đạt chuẩn</option>
            </select>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddAnimalOrCrop} className="bg-white rounded-2xl p-3 border border-black/5 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isCultivation ? 'Tên cây trồng (vd: Dưa lưới TL3)' : 'Loài vật nuôi (vd: Heo thịt)'}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  placeholder={isCultivation ? 'Giống / Lô' : 'Giống (vd: Yorkshire)'}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]"
                />
                <input
                  type="number"
                  value={newQtyOrWeight}
                  onChange={(e) => setNewQtyOrWeight(e.target.value)}
                  placeholder={isCultivation ? 'Số lượng (cây)' : 'Cân nặng (kg)'}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]"
                />
              </div>
              <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">
                Lưu vào {penName}
              </button>
            </form>
          )}

          {activeLogTarget && (
            <form onSubmit={handleSubmitAction} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[12px] font-bold text-emerald-900">
                <span>
                  {activeLogTarget.kind === 'weight' && `Cân nặng: ${activeLogTarget.label}`}
                  {activeLogTarget.kind === 'health' && `Sức khỏe: ${activeLogTarget.label}`}
                  {activeLogTarget.kind === 'transfer' && `Chuyển chuồng: ${activeLogTarget.label}`}
                  {activeLogTarget.kind === 'growth' && `Đo sinh trưởng: ${activeLogTarget.label}`}
                  {activeLogTarget.kind === 'care' && `Chăm sóc: ${activeLogTarget.label}`}
                </span>
                <button type="button" onClick={() => setActiveLogTarget(null)} className="text-slate-500">✕</button>
              </div>
              {activeLogTarget.kind === 'transfer' ? (
                <select
                  value={logInput1}
                  onChange={(e) => setLogInput1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-200 text-[12px]"
                  required
                >
                  <option value="">-- Chọn chuồng đích --</option>
                  {pens.filter((p) => p.id !== penId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type={activeLogTarget.kind === 'weight' || activeLogTarget.kind === 'growth' ? 'number' : 'text'}
                    value={logInput1}
                    onChange={(e) => setLogInput1(e.target.value)}
                    placeholder={
                      activeLogTarget.kind === 'weight'
                        ? 'Cân nặng mới (kg)'
                        : activeLogTarget.kind === 'health'
                        ? 'Trạng thái (Healthy / Sick)'
                        : activeLogTarget.kind === 'growth'
                        ? 'Chiều cao (cm)'
                        : 'Thao tác (Tưới nước, Bón phân...)'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-200 text-[12px]"
                    required
                  />
                  {activeLogTarget.kind !== 'weight' && (
                    <input
                      type="text"
                      value={logInput2}
                      onChange={(e) => setLogInput2(e.target.value)}
                      placeholder="Ghi chú chi tiết..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-200 text-[12px]"
                    />
                  )}
                </>
              )}
              <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">
                Xác nhận
              </button>
              {existingLogs.length > 0 && (
                <div className="pt-2 border-t border-emerald-200 space-y-1 max-h-36 overflow-y-auto">
                  <span className="text-[11px] font-bold text-emerald-900 block">Lịch sử đã ghi ({existingLogs.length}):</span>
                  {existingLogs.map((l, i) => (
                    <div key={l.id || i} className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg">
                      <span className="truncate">
                        {l.weight ? `${l.weight} kg` : l.height_or_size ? `${l.height_or_size} cm` : `${l.title || l.action || l.type || ''} ${l.note ? `• ${l.note}` : ''}`}
                      </span>
                      {l.id && (
                        <button type="button" onClick={() => handleDeleteLogItem(l.id)} className="text-rose-500 ml-2 shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

          <div className="space-y-2">
            {!isCultivation && animals
              .filter((a) => {
                const q = searchQuery.trim().toLowerCase();
                const matchQ = !q || String(a.id).toLowerCase().includes(q) || String(a.species).toLowerCase().includes(q);
                const st = String(a.status || 'Healthy').toLowerCase();
                if (statusFilter === 'attention') return matchQ && (st === 'sick' || st === 'anorexic');
                if (statusFilter === 'ready') return matchQ && Number(a.weight || 0) >= Number(a.target_weight || 9999);
                if (statusFilter === 'healthy') return matchQ && st !== 'sick';
                return matchQ;
              })
              .map((a) => (
              <div key={a.id} className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-bold text-slate-900">{a.id} • {a.species}</div>
                    <div className="text-[11px] text-slate-500">{a.breed || 'Tiêu chuẩn'} • {a.weight ?? '--'} kg</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    String(a.status).toLowerCase() === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {a.status || 'Healthy'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => openLogPanel('weight', a.id, a.id, String(a.weight || ''))} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Scale className="w-3 h-3" /> Cân
                  </button>
                  <button type="button" onClick={() => openLogPanel('health', a.id, a.id, a.status || 'Healthy')} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <HeartPulse className="w-3 h-3" /> Sức khỏe
                  </button>
                  <button type="button" onClick={() => openLogPanel('transfer', a.id, a.id, '')} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <ArrowRightLeft className="w-3 h-3" /> Chuyển
                  </button>
                  <button type="button" onClick={() => handleHarvestAnimal(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    Xuất chuồng
                  </button>
                  <button type="button" onClick={() => handleDeleteAnimal(a.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-semibold ml-auto">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {isCultivation && crops
              .filter((c) => {
                const q = searchQuery.trim().toLowerCase();
                return !q || String(c.name).toLowerCase().includes(q) || String(c.variety || '').toLowerCase().includes(q);
              })
              .map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-bold text-slate-900">{c.name}</div>
                    <div className="text-[11px] text-slate-500">{c.variety || 'Tiêu chuẩn'} • {c.quantity ?? 0} cây</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    {c.status || 'Growing'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => openLogPanel('growth', String(c.id), c.name, '')} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Sprout className="w-3 h-3" /> Sinh trưởng
                  </button>
                  <button type="button" onClick={() => openLogPanel('care', String(c.id), c.name, 'Tưới nước')} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Droplets className="w-3 h-3" /> Chăm sóc
                  </button>
                  <button type="button" onClick={() => handleHarvestCrop(c)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    Thu hoạch
                  </button>
                  <button type="button" onClick={() => handleDeleteCrop(String(c.id))} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-semibold ml-auto">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {((!isCultivation && animals.length === 0) || (isCultivation && crops.length === 0)) && (
              <div className="bg-white rounded-2xl p-4 text-center text-[12px] text-slate-400">
                Chưa có dữ liệu trong {penName || 'khu vực này'}.
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'inventory' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInvFormMode(invFormMode === 'import' ? 'none' : 'import')}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold"
            >
              + Nhập kho
            </button>
            <button
              type="button"
              onClick={() => setInvFormMode(invFormMode === 'export' ? 'none' : 'export')}
              className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-[12px] font-bold"
            >
              ↗ Xuất cho chuồng
            </button>
          </div>

          {invFormMode === 'import' && (
            <form onSubmit={handleImportInventory} className="bg-white rounded-2xl p-3 border border-black/5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={invCat} onChange={(e) => setInvCat(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]">
                  <option value="Feed">Thức ăn</option>
                  <option value="Fertilizer">Phân bón</option>
                  <option value="Medicine">Thuốc / Khác</option>
                </select>
                <input type="text" value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Tên vật tư" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={invQty} onChange={(e) => setInvQty(e.target.value)} placeholder="SL" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
                <input type="text" value={invUnit} onChange={(e) => setInvUnit(e.target.value)} placeholder="Đơn vị" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
                <input type="number" value={invPrice} onChange={(e) => setInvPrice(e.target.value)} placeholder="Đơn giá" className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" />
              </div>
              <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold">Lưu nhập kho</button>
            </form>
          )}

          {invFormMode === 'export' && (
            <form onSubmit={handleExportInventory} className="bg-white rounded-2xl p-3 border border-black/5 space-y-2">
              <select value={exportItemId} onChange={(e) => setExportItemId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]">
                {inventory.map((i) => (
                  <option key={i.id} value={String(i.id)}>{i.name} (Tồn: {i.quantity} {i.unit})</option>
                ))}
              </select>
              <input type="number" value={invQty} onChange={(e) => setInvQty(e.target.value)} placeholder="Số lượng xuất" className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px]" required />
              <button type="submit" className="w-full py-2 rounded-xl bg-amber-600 text-white text-[12px] font-bold">Xác nhận xuất kho</button>
            </form>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              placeholder="Tìm tên vật tư..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-black/5 text-[12px] outline-none"
            />
            <select
              value={invCatFilter}
              onChange={(e) => setInvCatFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-black/5 text-[12px] outline-none"
            >
              <option value="All">Tất cả</option>
              <option value="Feed">Thức ăn</option>
              <option value="Fertilizer">Phân bón</option>
              <option value="Medicine">Thuốc / Khác</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" /> Tồn kho ({inventory.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  exportCsv(
                    'ton-kho-vargon',
                    ['Tên vật tư', 'Danh mục', 'Số lượng', 'Đơn vị', 'Đơn giá'],
                    inventory.map((i) => [i.name, i.category, i.quantity, i.unit, i.unit_price || 0])
                  )
                }
                className="text-[11px] font-bold text-emerald-700"
              >
                Xuất CSV
              </button>
            </div>
            {inventory
              .filter((item) => {
                const matchSearch = !invSearch.trim() || String(item.name).toLowerCase().includes(invSearch.trim().toLowerCase());
                const matchCat = invCatFilter === 'All' || String(item.category).toLowerCase() === invCatFilter.toLowerCase();
                return matchSearch && matchCat;
              })
              .map((item) => {
              const low = Number(item.quantity || 0) <= 5;
              return (
                <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between text-[12px]">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      {item.name}
                      {low && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                    </div>
                    <div className="text-[10px] text-slate-500">{item.category}</div>
                  </div>
                  <div className="text-right font-bold">
                    <span className={low ? 'text-rose-600' : 'text-emerald-700'}>
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {invLogs.length > 0 && (
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-slate-900">Nhật ký kho ({invLogs.length})</span>
                <div className="flex items-center gap-2">
                  <select
                    value={logActionFilter}
                    onChange={(e) => setLogActionFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-100 text-[11px]"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="IMPORT">Nhập kho</option>
                    <option value="EXPORT">Xuất kho</option>
                    <option value="ANIMAL_EXPORT">Xuất chuồng</option>
                    <option value="CROP_HARVEST">Thu hoạch</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        'nhat-ky-kho-vargon',
                        ['Loại', 'Tên', 'Số lượng', 'Ghi chú'],
                        invLogs.map((l) => [l.action_type, l.item_name, l.quantity, l.note || ''])
                      )
                    }
                    className="text-[11px] font-bold text-emerald-700"
                  >
                    CSV
                  </button>
                </div>
              </div>
              {invLogs
                .filter((l) => logActionFilter === 'ALL' || l.action_type === logActionFilter)
                .slice(0, 12)
                .map((l, idx) => (
                <div key={l.id || idx} className="text-[11px] text-slate-600 flex justify-between border-b border-slate-100 pb-1 last:border-0">
                  <span>{l.action_type === 'IMPORT' ? '📥' : '📤'} {l.item_name} ({l.quantity} {l.unit || ''})</span>
                  <span className="text-slate-400 truncate max-w-[140px]">{l.note || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
