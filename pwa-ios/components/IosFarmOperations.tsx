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

  // Quick action modal-like inline state
  const [activeLogTarget, setActiveLogTarget] = useState<{
    kind: 'weight' | 'health' | 'transfer' | 'growth' | 'care';
    id: string;
    label: string;
  } | null>(null);
  const [logInput1, setLogInput1] = useState('');
  const [logInput2, setLogInput2] = useState('');

  // Inventory
  const [inventory, setInventory] = useState<any[]>([]);
  const [invLogs, setInvLogs] = useState<any[]>([]);
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
                {isCultivation ? 'Thêm cây' : 'Thêm vật nuôi'}
              </button>
            </div>
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
            </form>
          )}

          <div className="space-y-2">
            {!isCultivation && animals.map((a) => (
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
                  <button type="button" onClick={() => { setActiveLogTarget({ kind: 'weight', id: a.id, label: a.id }); setLogInput1(String(a.weight || '')); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Scale className="w-3 h-3" /> Cân
                  </button>
                  <button type="button" onClick={() => { setActiveLogTarget({ kind: 'health', id: a.id, label: a.id }); setLogInput1(a.status || 'Healthy'); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <HeartPulse className="w-3 h-3" /> Sức khỏe
                  </button>
                  <button type="button" onClick={() => { setActiveLogTarget({ kind: 'transfer', id: a.id, label: a.id }); setLogInput1(''); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <ArrowRightLeft className="w-3 h-3" /> Chuyển chuồng
                  </button>
                  <button type="button" onClick={() => handleDeleteAnimal(a.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-semibold ml-auto">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {isCultivation && crops.map((c) => (
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
                  <button type="button" onClick={() => { setActiveLogTarget({ kind: 'growth', id: String(c.id), label: c.name }); setLogInput1(''); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Sprout className="w-3 h-3" /> Sinh trưởng
                  </button>
                  <button type="button" onClick={() => { setActiveLogTarget({ kind: 'care', id: String(c.id), label: c.name }); setLogInput1('Tưới nước'); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">
                    <Droplets className="w-3 h-3" /> Chăm sóc
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

          <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" /> Tồn kho ({inventory.length})
              </span>
            </div>
            {inventory.map((item) => {
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
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 space-y-1.5">
              <span className="text-[12px] font-bold text-slate-900 block">Nhật ký kho gần đây</span>
              {invLogs.slice(0, 6).map((l, idx) => (
                <div key={l.id || idx} className="text-[11px] text-slate-600 flex justify-between border-b border-slate-100 pb-1 last:border-0">
                  <span>{l.action_type === 'IMPORT' ? '📥' : '📤'} {l.item_name} ({l.quantity} {l.unit})</span>
                  <span className="text-slate-400">{l.note || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
