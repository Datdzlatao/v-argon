'use client';

import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  Minus,
  AlertCircle,
  FileSpreadsheet,
  ClipboardList,
} from 'lucide-react';
import { exportTableToExcel } from '../lib/export-excel';
import {
  OperationLog,
  getActionMeta,
  formatLogTime,
  exportOperationLogsToExcel,
} from '../lib/operation-logs';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price?: number;
  unit_price?: number;
}

interface FeedInventoryProps {
  items: InventoryItem[];
  logs?: OperationLog[];
  pens?: Array<{ id: string; name: string }>;
  onOpenImport: () => void;
  onOpenExport: () => void;
  currentMode?: 'livestock' | 'cultivation';
}

export default function FeedInventory({
  items,
  logs = [],
  pens = [],
  onOpenImport,
  onOpenExport,
  currentMode = 'livestock',
}: FeedInventoryProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState('');

  const isLivestock = currentMode === 'livestock';

  const getPenName = (penId?: string | null) => {
    if (!penId) return 'Kho Chung';
    const found = pens.find((p) => String(p.id) === String(penId));
    return found ? `${found.name} (${found.id})` : penId;
  };

  // Lọc danh mục vật tư
  const filtered = items.filter((item) => {
    const matchName = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
    return matchName && matchCat;
  });

  // Lọc nhật ký hoạt động
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      const matchAction = logActionFilter === 'ALL' || log.action_type === logActionFilter;
      const matchQuery =
        !q ||
        (log.item_name || '').toLowerCase().includes(q) ||
        (log.note || '').toLowerCase().includes(q) ||
        (log.pen_id || '').toLowerCase().includes(q);
      return matchAction && matchQuery;
    });
  }, [logs, logActionFilter, logSearch]);

  const handleExportStockExcel = () => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    exportTableToExcel(
      `ton-kho-vat-tu-${dateSuffix}`,
      'Tồn Kho Vật Tư',
      ['STT', 'Tên Vật Tư', 'Phân Loại', 'Số Lượng Tồn', 'Đơn Vị', 'Đơn Giá (VNĐ)', 'Trạng Thái'],
      filtered.map((item, idx) => [
        idx + 1,
        item.name,
        item.category === 'Feed'
          ? 'Thức ăn chăn nuôi'
          : item.category === 'Fertilizer'
          ? 'Phân bón & Dinh dưỡng'
          : 'Vật tư khác',
        item.quantity,
        item.unit,
        item.unit_price ?? item.price ?? 0,
        item.quantity <= 0 ? 'Hết hàng' : item.quantity <= 5 ? 'Sắp hết' : 'Còn hàng',
      ])
    );
  };

  const handleExportLogsExcel = () => {
    exportOperationLogsToExcel(
      filteredLogs,
      'nhat-ky-nhap-xuat-kho-xuat-chuong',
      'Nhật Ký Kho & Xuất Chuồng',
      getPenName
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
      {/* Tiêu đề & Nút xuất nhập */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Kho Vật Tư &amp; Nhật Ký Hoạt Động
            </h4>
            <p className="text-xs text-slate-500">
              {items.length} mặt hàng tồn kho • {logs.length} lượt nhập / xuất / xuất chuồng
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenImport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Nhập Kho</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Minus className="w-4 h-4 shrink-0" />
            <span>Xuất Dùng</span>
          </button>

          <button
            type="button"
            onClick={activeTab === 'stock' ? handleExportStockExcel : handleExportLogsExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>{activeTab === 'stock' ? 'Xuất Excel Kho' : 'Xuất Excel Log'}</span>
          </button>
        </div>
      </div>

      {/* Tabs: Tồn Kho vs Nhật Ký */}
      <div className="flex items-center gap-2 mt-3 mb-3 border-b border-fb-divider pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'stock'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-fb-bg text-fb-muted hover:text-fb-text'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Tồn Kho ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-fb-bg text-fb-muted hover:text-fb-text'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Nhật Ký Nhập / Xuất / Xuất Chuồng ({logs.length})</span>
        </button>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Thanh tìm kiếm & bộ lọc */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-fb-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  isLivestock
                    ? 'Tìm tên hàng (Ví dụ: Cám con cò, thức ăn đậm đặc...)'
                    : 'Tìm tên hàng (Ví dụ: Phân NPK, Đạm vi sinh...)'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-fb-bg text-xs rounded-xl pl-9 pr-3 py-2 border border-fb-divider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            {/* Quick Filter Category Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setCategoryFilter('All')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  categoryFilter === 'All'
                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                    : 'text-fb-muted hover:bg-fb-hover'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setCategoryFilter('Feed')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  categoryFilter === 'Feed'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-fb-muted hover:bg-fb-hover'
                }`}
              >
                <span>🥩</span>
                <span>Thức Ăn</span>
              </button>
              <button
                onClick={() => setCategoryFilter('Fertilizer')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  categoryFilter === 'Fertilizer'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-fb-muted hover:bg-fb-hover'
                }`}
              >
                <span>🌱</span>
                <span>Phân Bón</span>
              </button>
              <button
                onClick={() => setCategoryFilter('Other')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  categoryFilter === 'Other'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-fb-muted hover:bg-fb-hover'
                }`}
              >
                <span>🛠️</span>
                <span>Khác</span>
              </button>
            </div>
          </div>

          {/* Danh sách vật tư */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-fb-muted text-xs border border-dashed border-fb-divider rounded-xl">
                Không tìm thấy vật tư nào phù hợp với tìm kiếm.
              </div>
            ) : (
              filtered.map((item) => {
                const isOutOfStock = item.quantity <= 0;
                const isLowStock = item.quantity > 0 && item.quantity <= 5;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-fb-bg/40 border border-fb-divider hover:bg-white hover:shadow-sm transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-sm shadow-sm border border-fb-divider shrink-0">
                        {item.category === 'Feed' ? '🥩' : item.category === 'Fertilizer' ? '🌱' : '🛠️'}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-fb-text block truncate">{item.name}</span>
                        <span className="text-[10px] text-fb-muted block">
                          Phân loại: {item.category === 'Feed' ? 'Thức ăn chăn nuôi' : item.category === 'Fertilizer' ? 'Phân bón & Dinh dưỡng' : 'Dụng cụ'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-extrabold text-sm text-fb-text">
                          {item.quantity}{' '}
                          <span className="text-xs font-normal text-fb-muted">{item.unit}</span>
                        </div>
                        {isOutOfStock ? (
                          <span className="text-[10px] text-red-600 font-bold flex items-center gap-0.5 justify-end">
                            <AlertCircle className="w-3 h-3" /> Hết hàng
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 justify-end">
                            <AlertCircle className="w-3 h-3" /> Sắp hết
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold">Còn hàng</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* Thanh tìm kiếm & lọc nhật ký */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-fb-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên hàng, mã cá thể, chuồng hoặc ghi chú..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full bg-fb-bg text-xs rounded-xl pl-9 pr-3 py-2 border border-fb-divider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'IMPORT', label: '📥 Nhập Kho' },
                { key: 'EXPORT', label: '📤 Xuất Kho' },
                { key: 'ANIMAL_EXPORT', label: '🚚 Xuất Chuồng' },
                { key: 'CROP_HARVEST', label: '🌾 Thu Hoạch' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLogActionFilter(opt.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    logActionFilter === opt.key
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-fb-muted hover:bg-fb-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách nhật ký */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-6 text-fb-muted text-xs border border-dashed border-fb-divider rounded-xl">
                Chưa có nhật ký nào phù hợp. Khi bạn Nhập kho, Xuất kho, Xuất chuồng hoặc Thu hoạch, hệ thống sẽ tự động lưu tại đây.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const meta = getActionMeta(log.action_type);
                return (
                  <div
                    key={String(log.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-fb-bg/40 border border-fb-divider hover:bg-white transition"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}
                        >
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                        <span className="font-bold text-xs text-fb-text truncate">
                          {log.item_name}
                        </span>
                        <span className="text-[11px] font-semibold text-fb-muted">
                          • {getPenName(log.pen_id)}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-[11px] text-fb-muted break-words">{log.note}</p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1">
                      <span className="font-extrabold text-xs text-fb-text">
                        {log.amount} {meta.unitHint}
                      </span>
                      <span className="text-[10px] text-fb-muted">
                        {formatLogTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
