import { exportTableToExcel } from './export-excel';

export type OperationActionType =
  | 'IMPORT'
  | 'EXPORT'
  | 'ANIMAL_EXPORT'
  | 'CROP_HARVEST';

export interface OperationLog {
  id: string | number;
  item_name: string;
  action_type: OperationActionType | string;
  amount: number;
  pen_id?: string | null;
  note?: string | null;
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'smart_farm_operation_logs_v1';

function getStorageKey(userId?: string | null): string {
  return userId ? `${LOCAL_STORAGE_KEY}_${userId}` : LOCAL_STORAGE_KEY;
}

export const ACTION_META: Record<
  string,
  { label: string; badgeClass: string; icon: string; unitHint: string }
> = {
  IMPORT: {
    label: 'Nhập Kho',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: '📥',
    unitHint: '',
  },
  EXPORT: {
    label: 'Xuất Kho',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '📤',
    unitHint: '',
  },
  ANIMAL_EXPORT: {
    label: 'Xuất Chuồng',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: '🚚',
    unitHint: 'kg',
  },
  CROP_HARVEST: {
    label: 'Thu Hoạch',
    badgeClass: 'bg-lime-100 text-lime-800 border-lime-200',
    icon: '🌾',
    unitHint: 'gốc',
  },
};

export function getActionMeta(actionType: string) {
  return (
    ACTION_META[actionType] || {
      label: actionType || 'Hoạt Động',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: '📋',
      unitHint: '',
    }
  );
}

export function formatLogTime(dateStr?: string): string {
  if (!dateStr) return 'Vừa xong';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function loadLocalOperationLogs(userId?: string | null): OperationLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalOperationLogs(logs: OperationLog[], userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(logs.slice(0, 300)));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeOperationLogs(
  remoteLogs: OperationLog[],
  localLogs: OperationLog[]
): OperationLog[] {
  const seen = new Set<string>();
  const combined: OperationLog[] = [];

  for (const log of [...remoteLogs, ...localLogs]) {
    const key = `${log.action_type}|${log.item_name}|${log.amount}|${log.pen_id || ''}|${(log.created_at || '').slice(0, 19)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(log);
  }

  return combined.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export function exportOperationLogsToExcel(
  logs: OperationLog[],
  filenamePrefix = 'nhat-ky-nhap-xuat-nong-trai',
  sheetName = 'Nhật Ký Hoạt Động',
  penNameLookup?: (penId?: string | null) => string
): void {
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const headers = [
    'STT',
    'Thời Gian',
    'Loại Nghiệp Vụ',
    'Đối Tượng / Vật Tư',
    'Số Lượng / Cân Nặng',
    'Khu Vực / Chuồng',
    'Chi Tiết & Ghi Chú',
  ];

  const rows = logs.map((log, idx) => {
    const meta = getActionMeta(log.action_type);
    const penLabel = log.pen_id
      ? penNameLookup
        ? penNameLookup(log.pen_id)
        : log.pen_id
      : 'Kho Chung';
    return [
      idx + 1,
      formatLogTime(log.created_at),
      meta.label,
      log.item_name || '',
      log.amount ?? 0,
      penLabel,
      log.note || '',
    ];
  });

  exportTableToExcel(`${filenamePrefix}-${dateSuffix}`, sheetName, headers, rows);
}
