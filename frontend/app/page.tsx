'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BACKEND_URL,
  connectAgentWebSocket, 
  triggerDailyBriefing, 
  controlDeviceViaAPI,
  updatePenMetadataAPI,
  fetchNewsfeedState,
  executeNewsfeedQuickApi,
  NewsfeedItem,
} from '../lib/agent-api';
import Navbar from '../components/Navbar';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import StoriesBar from '../components/StoriesBar';
import FeedAlertPinned from '../components/FeedAlertPinned';
import FeedBriefingCard from '../components/FeedBriefingCard';
import FeedEnvMonitor from '../components/FeedEnvMonitor';
import FeedStaffAttendance from '../components/FeedStaffAttendance';
import FeedPenCamera from '../components/FeedPenCamera';
import FeedLivestockCrops from '../components/FeedLivestockCrops';
import FeedInventory from '../components/FeedInventory';
import FeedExtendedModules from '../components/FeedExtendedModules';
import MessengerChatBubble from '../components/MessengerChatBubble';
import LandingIntro from '../components/LandingIntro';
import {
  ModalAddPen,
  ModalConfigCamera,
  ModalAddDevice,
  ModalAddAnimal,
  ModalHealth,
  ModalWeightTracking,
  ModalImport,
  ModalExport,
  ModalAddCrop,
  ModalCropTracking,
  ModalCropCare,
} from '../components/Modals';
import { ShieldAlert, Sparkles, Sprout, ArrowRight, Home as HomeIcon, LayoutGrid, Briefcase } from 'lucide-react';
import {
  OperationLog,
  OperationActionType,
  loadLocalOperationLogs,
  saveLocalOperationLogs,
  mergeOperationLogs,
} from '../lib/operation-logs';

const DEMO_USER_STORAGE_KEY = 'vargon_demo_user_id';

function getOrCreateDemoUserId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000';
  try {
    const existing = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (existing && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(existing)) {
      return existing;
    }
    const generated =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, generated);
    return generated;
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

export default function Home() {
  // --- AUTH STATE ---
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUserId, setDemoUserId] = useState<string>('');
  const activeUserId: string | null = session?.user?.id || (isDemoMode ? demoUserId || getOrCreateDemoUserId() : null);

  // --- APP STATE ---
  const [dashboardTab, setDashboardTab] = useState<'home' | 'operations' | 'general'>('home');
  const [currentMode, setCurrentMode] = useState<'livestock' | 'cultivation'>('livestock');
  const [pens, setPens] = useState<any[]>([]);
  const [currentPenId, setCurrentPenId] = useState<string>('');
  const [devices, setDevices] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<OperationLog[]>([]);

  // Environment Realtime Metrics
  const [envData, setEnvData] = useState({ temp: 28.5, hum: 70, smell: 150 });
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  // Alerts & Notifications
  const [activeAlerts, setActiveAlerts] = useState<Record<string, string[]>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);

  // Messenger Floating State
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);

  // Agent Connection & Briefing & Newsfeed
  const [wsConnected, setWsConnected] = useState(false);
  const [briefingText, setBriefingText] = useState('');
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [newsfeedItems, setNewsfeedItems] = useState<NewsfeedItem[]>([]);
  const [newsfeedCounts, setNewsfeedCounts] = useState<{
    pending: number;
    lowStock: number;
    sick: number;
  } | null>(null);
  const [isNewsfeedLoading, setIsNewsfeedLoading] = useState(false);

  const loadNewsfeed = async (penId?: string) => {
    const uid = activeUserIdRef.current;
    if (!uid) {
      setNewsfeedItems([]);
      return;
    }
    setIsNewsfeedLoading(true);
    const state = await fetchNewsfeedState(penId, 12, uid);
    if (state) {
      setNewsfeedItems(state.items || []);
      if (state.summary_text) {
        setBriefingText(state.summary_text);
      }
      setNewsfeedCounts({
        pending: state.pending_tasks_count,
        lowStock: state.low_stock_count,
        sick: state.sick_animals_count,
      });
    }
    setIsNewsfeedLoading(false);
  };

  const handleNewsfeedQuickAction = async (item: NewsfeedItem) => {
    // Luôn chuyển đúng khu vực (pen_id) trước khi thao tác
    if (item.pen_id && item.pen_id !== currentPenIdRef.current) {
      setCurrentPenId(item.pen_id);
      currentPenIdRef.current = item.pen_id;
      await loadPenData(item.pen_id);
    }

    if (item.quick_api) {
      try {
        await executeNewsfeedQuickApi(item.quick_api.endpoint, item.quick_api.body);
        showRealtimeNotification('devices', `Đã xử lý tại ${item.title}: ${item.action_label}`);
        await loadPenData(item.pen_id || currentPenIdRef.current);
        await loadNewsfeed();
      } catch {
        showRealtimeNotification('devices', 'Không kết nối được tới máy chủ thiết bị');
      }
      return;
    }

    if (item.action_route === 'chat') {
      setIsMessengerOpen(true);
    } else if (item.action_route === 'inventory') {
      setDashboardTab('operations');
      setTimeout(() => document.getElementById('section-inventory')?.scrollIntoView({ behavior: 'smooth' }), 80);
      setModalOpen((prev) => ({ ...prev, importInv: true }));
    } else if (item.action_route === 'livestock') {
      setDashboardTab('home');
      setCurrentMode('livestock');
      currentModeRef.current = 'livestock';
      setTimeout(() => document.getElementById('section-livestock-crops')?.scrollIntoView({ behavior: 'smooth' }), 80);
      if (item.target_type === 'animal' && item.target_id) {
        setSelectedAnimalId(item.target_id);
        selectedAnimalIdRef.current = item.target_id;
        const { data } = await supabase.from('health_logs').select('*').eq('animal_id', item.target_id);
        setAnimalHealthLogs(data || []);
        setModalOpen((prev) => ({ ...prev, health: true }));
      }
    } else if (item.action_route === 'crops') {
      setDashboardTab('home');
      setCurrentMode('cultivation');
      currentModeRef.current = 'cultivation';
      setTimeout(() => document.getElementById('section-livestock-crops')?.scrollIntoView({ behavior: 'smooth' }), 80);
      if (item.target_type === 'crop' && item.target_id) {
        setSelectedCropId(item.target_id);
        selectedCropIdRef.current = item.target_id;
        const { data } = await supabase.from('crop_care_logs').select('*').eq('crop_id', item.target_id);
        setCropCareLogs(data || []);
        setModalOpen((prev) => ({ ...prev, cropCare: true }));
      }
    } else if (item.action_route === 'camera') {
      setDashboardTab('operations');
      setTimeout(() => document.getElementById('section-camera')?.scrollIntoView({ behavior: 'smooth' }), 80);
    } else {
      setDashboardTab('operations');
      setTimeout(() => document.getElementById('section-env')?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  // Modals Open State
  const [modalOpen, setModalOpen] = useState({
    addPen: false,
    configCamera: false,
    addDevice: false,
    addAnimal: false,
    health: false,
    weight: false,
    importInv: false,
    exportInv: false,
    addCrop: false,
    cropTrack: false,
    cropCare: false,
  });

  const handleUpdatePenCameras = async (penId: string, cameraUrl: string, webcamUrl: string) => {
    try {
      await updatePenMetadataAPI(penId, { camera_url: cameraUrl, webcam_url: webcamUrl });
      setPens((prev) =>
        prev.map((p) => (p.id === penId ? { ...p, camera_url: cameraUrl, webcam_url: webcamUrl } : p))
      );
      showRealtimeNotification('pens', `Đã cập nhật 2 luồng camera cho chuồng ${penId}`);
    } catch (e: any) {
      console.warn('Backend update pen notice:', e);
      setPens((prev) =>
        prev.map((p) => (p.id === penId ? { ...p, camera_url: cameraUrl, webcam_url: webcamUrl } : p))
      );
      showRealtimeNotification('pens', `Đã lưu cấu hình 2 luồng camera: IP Cam & Webcam`);
    }
  };

  // Target item for detailed modal views
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [animalHealthLogs, setAnimalHealthLogs] = useState<any[]>([]);
  const [animalWeightLogs, setAnimalWeightLogs] = useState<any[]>([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [cropGrowthLogs, setCropGrowthLogs] = useState<any[]>([]);
  const [cropCareLogs, setCropCareLogs] = useState<any[]>([]);

  // Realtime Live Toast State
  const [realtimeToast, setRealtimeToast] = useState<{ message: string; table: string } | null>(null);

  // Synchronization Refs (Avoid stale closures in realtime listeners)
  const currentPenIdRef = useRef(currentPenId);
  const currentModeRef = useRef(currentMode);
  const selectedAnimalIdRef = useRef(selectedAnimalId);
  const selectedCropIdRef = useRef(selectedCropId);
  const activeUserIdRef = useRef<string | null>(activeUserId);
  const userPenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { currentPenIdRef.current = currentPenId; }, [currentPenId]);
  useEffect(() => { currentModeRef.current = currentMode; }, [currentMode]);
  useEffect(() => { selectedAnimalIdRef.current = selectedAnimalId; }, [selectedAnimalId]);
  useEffect(() => { selectedCropIdRef.current = selectedCropId; }, [selectedCropId]);
  useEffect(() => { activeUserIdRef.current = activeUserId; }, [activeUserId]);
  useEffect(() => {
    userPenIdsRef.current = new Set(pens.map((p) => String(p.id).trim().toLowerCase()));
  }, [pens]);

  const showRealtimeNotification = (table: string, actionDesc: string) => {
    setRealtimeToast({ table, message: actionDesc });
    setTimeout(() => {
      setRealtimeToast((curr) => (curr?.message === actionDesc ? null : curr));
    }, 4500);
  };

  // 1. Initialize Audio & Auth Listener
  useEffect(() => {
    alarmSoundRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        activeUserIdRef.current = session.user.id;
        loadInitialData(session, session.user.id);
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && activeUserIdRef.current) {
        loadNewsfeed();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pollTimer = setInterval(() => {
      if (activeUserIdRef.current) loadNewsfeed();
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setIsDemoMode(false);
        activeUserIdRef.current = nextSession.user.id;
        loadInitialData(nextSession, nextSession.user.id);
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(pollTimer);
      subscription.unsubscribe();
    };
  }, []);

  // 2. Connect to Agent WebSocket for Live Events
  useEffect(() => {
    const disconnect = connectAgentWebSocket(
      async (event, data) => {
        const activePen = currentPenIdRef.current;
        if (event === 'device_update') {
          setDevices((prev) =>
            prev.map((d) => (
              d.name.toLowerCase().includes((data.name || '').toLowerCase()) || 
              String(d.id).trim() === String(data.id || '').trim() 
                ? { ...d, is_active: data.is_active } 
                : d
            ))
          );
          if (activePen) await loadPenData(activePen);
        } else if (event === 'animal_transfer') {
          if (activePen) await loadPenData(activePen);
        } else if (event === 'briefing') {
          if (data && data.content) {
            setBriefingText(data.content);
          }
        } else if (event === 'alert') {
          const alertPen = String(data?.pen_id || '').trim().toLowerCase();
          if (alertPen && !userPenIdsRef.current.has(alertPen)) return;
          setActiveAlerts((prev) => ({
            ...prev,
            [data.pen_id || 'unknown']: [data.message],
          }));
          loadNewsfeed();
        } else if (event === 'newsfeed_update') {
          loadNewsfeed();
        } else if (event === 'staff_checkin') {
          const staffPen = String(data?.pen_id || '').trim().toLowerCase();
          if (staffPen && !userPenIdsRef.current.has(staffPen)) return;
          const actionText = data.check_type === 'check_out' ? 'tan ca' : 'vào ca';
          showRealtimeNotification('staff', `👤 Nhân sự ${data.staff_name || data.staff_id} đã ${actionText} (${data.pen_id || 'Trang trại'})`);
        }
      },
      (status) => setWsConnected(status === 'connected')
    );

    return () => disconnect();
  }, []);

  // Handle Trigger Briefing
  const handleTriggerBriefing = async () => {
    setIsBriefingLoading(true);
    try {
      const res = await triggerDailyBriefing();
      if (res && res.briefing && res.briefing.content) {
        setBriefingText(res.briefing.content);
      }
    } catch (e) {
      console.error('Trigger briefing error:', e);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // 3. Alarm Loop: Beeps when problem pens exist and not muted
  useEffect(() => {
    const interval = setInterval(() => {
      const problemPens = Object.keys(activeAlerts);
      if (problemPens.length > 0 && !isMuted && alarmSoundRef.current) {
        alarmSoundRef.current.play().catch(() => {});
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [activeAlerts, isMuted]);

  // 3. Load Initial Farm Data (strictly isolated by activeUserId)
  const loadInitialData = async (activeSession = session, explicitUserId?: string | null) => {
    const uid = explicitUserId || activeSession?.user?.id || activeUserIdRef.current;
    if (!uid) return;
    activeUserIdRef.current = uid;
    await fetchPens(activeSession, uid);
    await fetchInventory(uid);
    await fetchInventoryLogs(uid);
    await loadNewsfeed();
  };

  // 4. Fetch Pens based on Mode & Strict User Isolation (both Logged-in and Demo Mode)
  const fetchPens = async (activeSession = session, explicitUserId?: string | null) => {
    const userId = explicitUserId || activeSession?.user?.id || activeUserIdRef.current;
    if (!userId) {
      setPens([]);
      setCurrentPenId('');
      currentPenIdRef.current = '';
      userPenIdsRef.current = new Set();
      return;
    }

    const { data } = await supabase
      .from('pens')
      .select('*')
      .eq('type', currentModeRef.current)
      .eq('user_id', userId)
      .order('id');

    if (data && data.length > 0) {
      setPens((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      userPenIdsRef.current = new Set(data.map((p: any) => String(p.id).trim().toLowerCase()));
      const currentSelected = currentPenIdRef.current;
      const exists = data.some(
        (p: any) => String(p.id).trim().toLowerCase() === String(currentSelected).trim().toLowerCase()
      );
      const activeId = exists ? currentSelected : data[0].id;
      if (currentPenIdRef.current !== activeId) {
        setCurrentPenId(activeId);
        currentPenIdRef.current = activeId;
      }
      await loadPenData(activeId);
    } else {
      // Khởi tạo chuồng/vườn mặc định riêng biệt gắn với user_id (áp dụng cho cả tài khoản mới & chế độ trải nghiệm)
      const modeTag = currentModeRef.current === 'livestock' ? 'L' : 'C';
      const defaultPenId = `PEN-${userId.substring(0, 6).toUpperCase()}-${modeTag}1`;
      const defaultPenName =
        currentModeRef.current === 'livestock'
          ? isDemoMode
            ? 'Chuồng Trải Nghiệm Khu 1'
            : 'Chuồng Nuôi Cá Nhân Khu 1'
          : isDemoMode
            ? 'Vườn Trải Nghiệm Khu 1'
            : 'Vườn Trồng Cá Nhân Khu 1';
      const starterPen = {
        id: defaultPenId,
        name: defaultPenName,
        type: currentModeRef.current,
        user_id: userId,
      };
      await supabase.from('pens').insert([starterPen]);
      setPens([starterPen]);
      userPenIdsRef.current = new Set([starterPen.id.trim().toLowerCase()]);
      setCurrentPenId(starterPen.id);
      currentPenIdRef.current = starterPen.id;
      await loadPenData(starterPen.id);
    }
  };

  // Change Mode (Livestock vs Cultivation)
  const handleModeChange = (newMode: 'livestock' | 'cultivation') => {
    setCurrentMode(newMode);
  };

  useEffect(() => {
    fetchPens();
  }, [currentMode]);

  // Load Specific Pen Data - Tự động so sánh và chỉ re-render khi DB có thay đổi thực sự
  const loadPenData = async (penId: string) => {
    if (!penId) return;

    // Devices: Luôn map pin_number sang pin để tương thích toàn bộ UI
    const { data: devs } = await supabase.from('devices').select('*').eq('pen_id', penId).order('id');
    if (devs) {
      const formattedDevs = devs.map((d: any) => ({ ...d, pin: d.pin_number ?? d.pin }));
      setDevices((prev) => (JSON.stringify(prev) === JSON.stringify(formattedDevs) ? prev : formattedDevs));
    }

    // Tải cả vật nuôi và cây trồng cho chuồng đang chọn
    const { data: anis } = await supabase.from('animals').select('*').eq('pen_id', penId).order('id');
    if (anis) {
      setAnimals((prev) => (JSON.stringify(prev) === JSON.stringify(anis) ? prev : anis));
    }

    const { data: crps } = await supabase.from('crops').select('*').eq('pen_id', penId).order('id');
    if (crps) {
      setCrops((prev) => (JSON.stringify(prev) === JSON.stringify(crps) ? prev : crps));
    }

    // Latest Environment Sensor Log
    const { data: envs } = await supabase
      .from('env_logs')
      .select('*')
      .eq('pen_id', penId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (envs && envs.length > 0) {
      const latest = envs[0];
      setEnvData((prev) => (
        prev.temp === latest.temperature &&
        prev.hum === latest.humidity &&
        prev.smell === (latest.smell_level || 0)
          ? prev
          : { temp: latest.temperature, hum: latest.humidity, smell: latest.smell_level || 0 }
      ));

      // Parse history
      const formatted = envs.reverse().map((e: any) => ({
        time: new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temp: e.temperature,
        hum: e.humidity,
        smell: e.smell_level || 0,
      }));
      setHistoryLogs((prev) => (JSON.stringify(prev) === JSON.stringify(formatted) ? prev : formatted));

      checkSensorAlert(penId, latest);
    } else {
      setEnvData({ temp: 28.5, hum: 70, smell: 140 });
    }
  };

  // Check and Register Alert
  const checkSensorAlert = (penId: string, data: any) => {
    const issues: string[] = [];
    if (data.temperature >= 35) issues.push(`Nóng quá ngưỡng (${data.temperature}°C)`);
    if (data.humidity >= 90) issues.push(`Ẩm ướt cao (${data.humidity}%)`);
    if (data.smell_level >= 400) issues.push(`Mùi hôi nguy hiểm (${data.smell_level} ppm)`);

    setActiveAlerts((prev) => {
      const copy = { ...prev };
      if (issues.length > 0) copy[penId] = issues;
      else delete copy[penId];
      return copy;
    });
  };

  // 5. Fetch Inventory - Chỉ tải kho gắn với user_id hiện tại
  const fetchInventory = async (explicitUserId?: string | null) => {
    const uid = explicitUserId || activeUserIdRef.current;
    if (!uid) {
      setInventory([]);
      return;
    }
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', uid)
      .order('category');
    if (data) {
      setInventory((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
    }
  };

  // 5b. Fetch Inventory & Operation Logs - Tách biệt theo user_id
  const fetchInventoryLogs = async (explicitUserId?: string | null) => {
    const uid = explicitUserId || activeUserIdRef.current;
    if (!uid) {
      setInventoryLogs([]);
      return;
    }
    const localLogs = loadLocalOperationLogs(uid);
    try {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) {
        const merged = mergeOperationLogs(data as OperationLog[], localLogs);
        setInventoryLogs((prev) => (JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged));
        saveLocalOperationLogs(merged, uid);
        return;
      }
    } catch (err) {
      console.warn('Error fetching inventory_logs:', err);
    }
    if (localLogs.length > 0) {
      setInventoryLogs((prev) => (JSON.stringify(prev) === JSON.stringify(localLogs) ? prev : localLogs));
    }
  };

  // Helper ghi log thống nhất cho Nhập kho, Xuất kho, Xuất chuồng, Thu hoạch
  const recordOperationLog = async (
    actionType: OperationActionType,
    itemName: string,
    amount: number,
    penId: string | null,
    note: string
  ) => {
    const uid = activeUserIdRef.current;
    const nowIso = new Date().toISOString();
    const localEntry: OperationLog = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      item_name: itemName,
      action_type: actionType,
      amount: Number(amount) || 0,
      pen_id: penId || null,
      note,
      created_at: nowIso,
    };

    setInventoryLogs((prev) => {
      const next = mergeOperationLogs([localEntry], prev);
      saveLocalOperationLogs(next, uid);
      return next;
    });

    try {
      const { error } = await supabase.from('inventory_logs').insert([
        {
          user_id: uid || null,
          item_name: itemName,
          action_type: actionType,
          amount: Number(amount) || 0,
          pen_id: penId || null,
          note,
          created_at: nowIso,
        },
      ]);
      if (!error) {
        await fetchInventoryLogs(uid);
      }
    } catch (err) {
      console.warn('Could not persist operation log to Supabase:', err);
    }
  };

  // 6. Supabase Full Realtime Subscription Across All Database Tables (Khởi tạo 1 lần duy nhất)
  useEffect(() => {
    const channelName = `farm-sync-${Date.now()}`;
    const channel = supabase.channel(channelName);
    const isSameId = (a: any, b: any) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

    channel
      // A. env_logs: Cảm biến môi trường
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'env_logs' },
        (payload: any) => {
          const newLog = payload.new;
          if (!newLog) return;
          checkSensorAlert(newLog.pen_id, newLog);

          if (isSameId(newLog.pen_id, currentPenIdRef.current)) {
            setEnvData({
              temp: newLog.temperature,
              hum: newLog.humidity,
              smell: newLog.smell_level || 0,
            });
            setHistoryLogs((prev) => [
              ...prev.slice(1),
              {
                time: new Date(newLog.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                temp: newLog.temperature,
                hum: newLog.humidity,
                smell: newLog.smell_level || 0,
              },
            ]);
            showRealtimeNotification('env_logs', `Cảm biến chuồng ${newLog.pen_id}: ${newLog.temperature}°C, ${newLog.humidity}%, Mùi ${newLog.smell_level || 0}`);
          }
        }
      )
      // B. devices: Thiết bị IoT bật/tắt hoặc thêm mới
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        async (payload: any) => {
          const { eventType, new: newDev, old: oldDev } = payload;
          const activePen = currentPenIdRef.current;
          if (eventType === 'INSERT') {
            if (isSameId(newDev.pen_id, activePen)) {
              const formatted = { ...newDev, pin: newDev.pin_number ?? newDev.pin };
              setDevices((prev) => [...prev.filter((d) => !isSameId(d.id, newDev.id)), formatted]);
              showRealtimeNotification('devices', `Đã thêm thiết bị mới: ${newDev.name}`);
              await loadPenData(activePen);
            }
          } else if (eventType === 'UPDATE') {
            if (isSameId(newDev.pen_id, activePen)) {
              const formatted = { ...newDev, pin: newDev.pin_number ?? newDev.pin };
              setDevices((prev) => {
                const exists = prev.some((d) => isSameId(d.id, newDev.id));
                return exists ? prev.map((d) => (isSameId(d.id, newDev.id) ? formatted : d)) : [...prev, formatted];
              });
              showRealtimeNotification('devices', `Thiết bị ${newDev.name} đổi trạng thái sang ${newDev.is_active ? 'BẬT' : 'TẮT'}`);
              await loadPenData(activePen);
            } else {
              setDevices((prev) => prev.filter((d) => !isSameId(d.id, newDev.id)));
            }
          } else if (eventType === 'DELETE') {
            setDevices((prev) => prev.filter((d) => !isSameId(d.id, oldDev.id)));
            showRealtimeNotification('devices', `Đã xóa thiết bị`);
            if (activePen) await loadPenData(activePen);
          }
        }
      )
      // C. animals: Đàn vật nuôi (cân nặng, trạng thái, chuyển chuồng)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animals' },
        async (payload: any) => {
          const { eventType, new: newAni, old: oldAni } = payload;
          const activePen = currentPenIdRef.current;
          if (eventType === 'INSERT') {
            if (isSameId(newAni.pen_id, activePen)) {
              setAnimals((prev) => [...prev.filter((a) => !isSameId(a.id, newAni.id)), newAni]);
              showRealtimeNotification('animals', `Đã thêm cá thể mới: ${newAni.id} (${newAni.species})`);
              await loadPenData(activePen);
            }
          } else if (eventType === 'UPDATE') {
            if (isSameId(newAni.pen_id, activePen)) {
              setAnimals((prev) => {
                const exists = prev.some((a) => isSameId(a.id, newAni.id));
                return exists ? prev.map((a) => (isSameId(a.id, newAni.id) ? newAni : a)) : [...prev, newAni];
              });
              showRealtimeNotification('animals', `Cập nhật thông tin vật nuôi ${newAni.id}`);
              await loadPenData(activePen);
            } else {
              setAnimals((prev) => prev.filter((a) => !isSameId(a.id, newAni.id)));
              showRealtimeNotification('animals', `Vật nuôi ${newAni.id} đã chuyển sang chuồng ${newAni.pen_id}`);
              if (activePen) await loadPenData(activePen);
            }
          } else if (eventType === 'DELETE') {
            setAnimals((prev) => prev.filter((a) => !isSameId(a.id, oldAni.id)));
            showRealtimeNotification('animals', `Đã xóa hồ sơ vật nuôi ${oldAni.id}`);
            if (activePen) await loadPenData(activePen);
          }
        }
      )
      // D. inventory: Kho thức ăn và vật tư (chỉ nhận đúng user_id hiện tại)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        async (payload: any) => {
          const { eventType, new: newItem, old: oldItem } = payload;
          const uid = activeUserIdRef.current;
          const rowUid = newItem?.user_id ?? oldItem?.user_id;
          if (!uid || (rowUid && rowUid !== uid)) return;
          if (eventType === 'INSERT') {
            if (!newItem?.user_id || newItem.user_id !== uid) return;
            setInventory((prev) => [...prev.filter((i) => !isSameId(i.id, newItem.id)), newItem]);
            showRealtimeNotification('inventory', `Kho nhập mặt hàng mới: ${newItem.name}`);
            await fetchInventory(uid);
          } else if (eventType === 'UPDATE') {
            if (!newItem?.user_id || newItem.user_id !== uid) return;
            setInventory((prev) => prev.map((i) => (isSameId(i.id, newItem.id) ? newItem : i)));
            showRealtimeNotification('inventory', `Tồn kho ${newItem.name}: ${newItem.quantity} ${newItem.unit}`);
            await fetchInventory(uid);
          } else if (eventType === 'DELETE') {
            setInventory((prev) => prev.filter((i) => !isSameId(i.id, oldItem.id)));
            showRealtimeNotification('inventory', `Đã xóa mặt hàng kho`);
            await fetchInventory(uid);
          }
        }
      )
      // D2. inventory_logs: Nhật ký nhập kho, xuất kho, xuất chuồng
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_logs' },
        async (payload: any) => {
          const uid = activeUserIdRef.current;
          const rowUid = payload.new?.user_id;
          if (!uid || (rowUid && rowUid !== uid)) return;
          await fetchInventoryLogs(uid);
        }
      )
      // E. crops: Cây trồng và mùa vụ
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crops' },
        async (payload: any) => {
          const { eventType, new: newCrop, old: oldCrop } = payload;
          const activePen = currentPenIdRef.current;
          if (eventType === 'INSERT') {
            if (isSameId(newCrop.pen_id, activePen)) {
              setCrops((prev) => [...prev.filter((c) => !isSameId(c.id, newCrop.id)), newCrop]);
              showRealtimeNotification('crops', `Đã thêm cây trồng mới: ${newCrop.name}`);
              await loadPenData(activePen);
            }
          } else if (eventType === 'UPDATE') {
            if (isSameId(newCrop.pen_id, activePen)) {
              setCrops((prev) => prev.map((c) => (isSameId(c.id, newCrop.id) ? newCrop : c)));
              await loadPenData(activePen);
            }
          } else if (eventType === 'DELETE') {
            setCrops((prev) => prev.filter((c) => !isSameId(c.id, oldCrop.id)));
            if (activePen) await loadPenData(activePen);
          }
        }
      )
      // F. pens: Danh sách chuồng trại (chỉ nhận chuồng thuộc user_id hiện tại)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pens' },
        async (payload: any) => {
          const { eventType, new: newPen, old: oldPen } = payload;
          const uid = activeUserIdRef.current;
          if (!uid) return;
          if (eventType === 'INSERT') {
            if (newPen?.user_id === uid && newPen.type === currentModeRef.current) {
              setPens((prev) => [...prev.filter((p) => !isSameId(p.id, newPen.id)), newPen]);
              showRealtimeNotification('pens', `Khu vực mới vừa tạo: ${newPen.name}`);
            }
          } else if (eventType === 'UPDATE') {
            if (newPen?.user_id !== uid) return;
            setPens((prev) => prev.map((p) => (isSameId(p.id, newPen.id) ? newPen : p)));
          } else if (eventType === 'DELETE') {
            setPens((prev) => prev.filter((p) => !isSameId(p.id, oldPen.id)));
          }
        }
      )
      // G. alerts: Cảnh báo hệ thống (chỉ nhận cảnh báo thuộc chuồng của user hiện tại)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload: any) => {
          const newAlert = payload.new;
          if (!newAlert) return;
          const alertPen = String(newAlert.pen_id || '').trim().toLowerCase();
          if (alertPen && !userPenIdsRef.current.has(alertPen)) return;
          setActiveAlerts((prev) => ({
            ...prev,
            [newAlert.pen_id || 'general']: [...(prev[newAlert.pen_id || 'general'] || []), newAlert.message],
          }));
          showRealtimeNotification('alerts', `⚠️ CẢNH BÁO MỚI: ${newAlert.message}`);
        }
      )
      // H. health_logs & weight_logs
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'health_logs' },
        (payload: any) => {
          const { eventType, new: newLog, old: oldLog } = payload;
          if (eventType === 'INSERT') {
            if (selectedAnimalIdRef.current && isSameId(newLog.animal_id, selectedAnimalIdRef.current)) {
              setAnimalHealthLogs((prev) => [newLog, ...prev]);
              showRealtimeNotification('health_logs', `Đã thêm nhật ký thú y`);
            }
          } else if (eventType === 'DELETE') {
            setAnimalHealthLogs((prev) => prev.filter((l) => !isSameId(l.id, oldLog.id)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'weight_logs' },
        async (payload: any) => {
          const newLog = payload.new;
          const activePen = currentPenIdRef.current;
          if (selectedAnimalIdRef.current && isSameId(newLog.animal_id, selectedAnimalIdRef.current)) {
            setAnimalWeightLogs((prev) => [...prev, newLog]);
            showRealtimeNotification('weight_logs', `Đã cập nhật cân nặng mới`);
          }
          if (activePen) await loadPenData(activePen);
        }
      )
      // I. staff_attendance: Điểm danh nhân sự realtime từ Supabase
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff_attendance' },
        (payload: any) => {
          const newAtt = payload.new;
          if (newAtt) {
            const actionText = newAtt.check_type === 'check_out' ? 'tan ca' : 'vào ca';
            showRealtimeNotification('staff', `👤 Nhân sự ${newAtt.staff_name || newAtt.staff_id} đã ${actionText} (${newAtt.pen_id || 'Trang trại'})`);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Full Database Realtime Subscription Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 7. Continuous Database Live Sync Loop (Vòng Lặp Lắng Nghe Trực Tiếp Từ Database)
  // Đảm bảo mọi phần hiển thị (vật nuôi, thiết bị, kho, cảm biến, cây trồng) luôn tự động đồng bộ từ DB
  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const continuousDatabaseSync = async () => {
      if (!isMounted || isFetching) return;
      const activePen = currentPenIdRef.current;
      if (!activePen) return;

      isFetching = true;
      try {
        await Promise.all([
          loadPenData(activePen),
          fetchInventory(),
          fetchInventoryLogs(),
        ]);

        // Nếu người dùng đang mở theo dõi chi tiết cá thể vật nuôi, tự động tải thêm logs mới
        const activeAnimal = selectedAnimalIdRef.current;
        if (activeAnimal && isMounted) {
          const { data: wLogs } = await supabase.from('weight_logs').select('*').eq('animal_id', activeAnimal).order('created_at', { ascending: false });
          if (wLogs) setAnimalWeightLogs((prev) => (JSON.stringify(prev) === JSON.stringify(wLogs) ? prev : wLogs));

          const { data: hLogs } = await supabase.from('health_logs').select('*').eq('animal_id', activeAnimal).order('created_at', { ascending: false });
          if (hLogs) setAnimalHealthLogs((prev) => (JSON.stringify(prev) === JSON.stringify(hLogs) ? prev : hLogs));
        }
      } catch (err) {
        console.warn('Continuous DB sync warning:', err);
      } finally {
        isFetching = false;
      }
    };

    // Chu kỳ 2000ms (2 giây): Luôn lắng nghe và tải trực tiếp dữ liệu mới nhất
    const syncInterval = setInterval(continuousDatabaseSync, 2000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  // Toggle Device Switch
  const handleToggleDevice = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const targetDev = devices.find((d) => String(d.id).trim() === String(id).trim());
    const activePen = currentPenIdRef.current;

    // Optimistic UI update
    setDevices((prev) => prev.map((d) => (String(d.id).trim() === String(id).trim() ? { ...d, is_active: nextStatus } : d)));
    await supabase.from('devices').update({ is_active: nextStatus }).eq('id', id);

    // Sync with Agent backend API
    if (targetDev && activePen) {
      try {
        await controlDeviceViaAPI(activePen, targetDev.name, nextStatus ? 'turn_on' : 'turn_off');
      } catch (err) {
        console.warn('Backend control API error:', err);
      }
    }
    showRealtimeNotification('devices', `Thiết bị ${targetDev?.name || id} đã chuyển sang ${nextStatus ? 'BẬT' : 'TẮT'}`);
    if (activePen) await loadPenData(activePen);
  };

  // Handle Xuất Chuồng (Animal Harvest / Sell / Export) - Không cần F5
  const handleExportAnimal = async (animal: any) => {
    const confirmed = confirm(
      `XÁC NHẬN XUẤT CHUỒNG:\nBạn có chắc muốn xuất bán cá thể ${animal.id} (${animal.species || 'Vật nuôi'}, Cân nặng: ${animal.weight} kg / Mục tiêu: ${animal.target_weight} kg)?`
    );
    if (!confirmed) return;

    const activePen = currentPenIdRef.current;

    // 1. Optimistic Update: Xóa ngay lập tức khỏi state để giao diện phản hồi tức thì
    setAnimals((prev) => prev.filter((a) => String(a.id).trim().toLowerCase() !== String(animal.id).trim().toLowerCase()));

    try {
      // 2. Xóa khỏi bảng animals trên Supabase
      await supabase.from('animals').delete().eq('id', animal.id);

      // 3. Ghi alert hệ thống
      await supabase.from('alerts').insert([
        {
          pen_id: activePen,
          alert_type: 'SYSTEM',
          message: `Đã xuất chuồng thành công cá thể ${animal.id} (${animal.species}, ${animal.weight} kg)`,
        },
      ]);

      // 3b. Lưu log xuất chuồng vào inventory_logs + localStorage
      await recordOperationLog(
        'ANIMAL_EXPORT',
        `${animal.id} (${animal.species || 'Vật nuôi'})`,
        Number(animal.weight || 0),
        activePen || null,
        `Xuất chuồng cá thể ${animal.id} • Giống: ${animal.species || 'Vật nuôi'} • Cân nặng: ${animal.weight} kg / Mục tiêu: ${animal.target_weight || 0} kg`
      );
    } catch (err) {
      console.error('Lỗi khi lưu xuất chuồng:', err);
    }

    // 4. Tự động tải lại dữ liệu chuồng để đồng bộ tuyệt đối mà KHÔNG CẦN F5!
    if (activePen) await loadPenData(activePen);
    showRealtimeNotification('animals', `🎉 ĐÃ XUẤT CHUỒNG THÀNH CÔNG: Cá thể ${animal.id} (${animal.weight} kg)`);
  };

  // Handle Thu Hoạch Vụ Mùa (Crop Harvest / Sell / Export) - Không cần F5
  const handleExportCrop = async (crop: any) => {
    const confirmed = confirm(
      `XÁC NHẬN THU HOẠCH:\nBạn có chắc muốn thu hoạch / xuất bán vụ mùa "${crop.name}" (Quy mô: ${crop.quantity} gốc/luống tại ${currentPen.name})?`
    );
    if (!confirmed) return;

    const activePen = currentPenIdRef.current;

    // 1. Optimistic Update: Xóa ngay lập tức khỏi state để giao diện phản hồi tức thì
    setCrops((prev) => prev.filter((c) => String(c.id).trim().toLowerCase() !== String(crop.id).trim().toLowerCase()));

    try {
      // 2. Xóa khỏi bảng crops trên Supabase
      await supabase.from('crops').delete().eq('id', crop.id);

      // 3. Ghi alert hệ thống
      await supabase.from('alerts').insert([
        {
          pen_id: activePen,
          alert_type: 'SYSTEM',
          message: `Đã thu hoạch thành công vụ mùa ${crop.name} (${crop.quantity} gốc)`,
        },
      ]);

      // 3b. Lưu log thu hoạch vào inventory_logs + localStorage
      await recordOperationLog(
        'CROP_HARVEST',
        `${crop.name} (ID: ${crop.id})`,
        Number(crop.quantity || 0),
        activePen || null,
        `Thu hoạch vụ mùa ${crop.name} • Quy mô: ${crop.quantity} gốc/luống`
      );
    } catch (err) {
      console.error('Lỗi khi lưu thu hoạch:', err);
    }

    // 4. Tự động tải lại dữ liệu chuồng/vườn để đồng bộ tuyệt đối
    if (activePen) await loadPenData(activePen);
    showRealtimeNotification('crops', `🎉 ĐÃ THU HOẠCH THÀNH CÔNG: Vụ mùa ${crop.name} (${crop.quantity} gốc)`);
  };

  // Current pen helper
  const currentPen = pens.find((p) => p.id === currentPenId) || { id: currentPenId, name: 'Chuồng Trang Trại' };
  const currentPenIssues = activeAlerts[currentPenId] || [];

  // Flatten Alerts for dropdown
  const alertList = Object.entries(activeAlerts).map(([pId, issues], idx) => {
    const p = pens.find((x) => x.id === pId);
    return {
      id: idx.toString(),
      penName: p ? p.name : `Chuồng ${pId}`,
      issues,
      time: 'Vừa xong',
    };
  });

  // Handle Login/Register
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      else setSession(data.session);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert('Đăng ký thành công! Vui lòng kiểm tra email hoặc đăng nhập.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsDemoMode(false);
    activeUserIdRef.current = null;
    userPenIdsRef.current = new Set();
    setPens([]);
    setCurrentPenId('');
    currentPenIdRef.current = '';
    setDevices([]);
    setAnimals([]);
    setCrops([]);
    setInventory([]);
    setInventoryLogs([]);
    setNewsfeedItems([]);
    setActiveAlerts({});
    setBriefingText('');
  };

  // --- RENDER LANDING INTRO + LOGIN IF NOT AUTHENTICATED & NOT DEMO ---
  if (!session && !isDemoMode) {
    return (
      <LandingIntro
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        authError={authError}
        handleAuth={handleAuth}
        onDemo={() => {
          const uid = getOrCreateDemoUserId();
          setDemoUserId(uid);
          setIsDemoMode(true);
          activeUserIdRef.current = uid;
          loadInitialData(null, uid);
        }}
      />
    );
  }

  // --- MAIN FACEBOOK NEWSFEED DASHBOARD ---
  return (
    <div className="min-h-screen bg-fb-bg flex flex-col">
      {/* 1. Facebook-Style Sticky Top Bar */}
      <Navbar
        currentMode={currentMode}
        onModeChange={handleModeChange}
        pens={pens}
        currentPenId={currentPenId}
        onPenChange={(pId) => {
          setCurrentPenId(pId);
          currentPenIdRef.current = pId;
          loadPenData(pId);
        }}
        userEmail={session?.user?.email || 'Người Quản Lý Trang Trại'}
        onLogout={handleLogout}
        alerts={alertList}
        onOpenMessenger={() => setIsMessengerOpen(true)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        unreadAlertsCount={alertList.length}
        wsConnected={wsConnected}
        onTriggerBriefing={handleTriggerBriefing}
      />

      {/* 1.5 Top Dashboard Tab Bar */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDashboardTab('home')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                dashboardTab === 'home'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              <HomeIcon className="w-4 h-4 shrink-0" />
              <span>Trang Chủ &amp; Đàn Nuôi</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardTab('operations')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                dashboardTab === 'operations'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span>Cảm Biến, Camera &amp; Kho</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardTab('general')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                dashboardTab === 'general'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Quản Lý Chung</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>Đang xem:</span>
            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {currentPen.name}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Tabbed Layout */}
      {dashboardTab === 'general' ? (
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 flex-1 min-w-0">
          <FeedExtendedModules
            penName="Toàn Trang Trại"
            userId={activeUserId}
          />
        </div>
      ) : (
      <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-w-0">
        {/* Left Column (Navigation & Pens) */}
        <LeftSidebar
          userEmail={session?.user?.email || 'nongdan@smartfarm.vn'}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          pens={pens.map((p) => ({ ...p, hasAlert: !!activeAlerts[p.id] }))}
          currentPenId={currentPenId}
          onSelectPen={(pId) => {
            setCurrentPenId(pId);
            currentPenIdRef.current = pId;
            loadPenData(pId);
          }}
          onOpenAddPenModal={() => setModalOpen({ ...modalOpen, addPen: true })}
        />

        {/* Center Column */}
        <main
          className={`min-w-0 w-full space-y-5 ${
            dashboardTab === 'home' ? 'lg:col-span-9 xl:col-span-6' : 'lg:col-span-9'
          }`}
        >
          {/* A. Facebook Stories Row (Chọn chuồng nhanh) */}
          <StoriesBar
            pens={pens.map((p) => ({
              ...p,
              hasAlert: !!activeAlerts[p.id],
              temp: p.id === currentPenId ? envData.temp : undefined,
              hum: p.id === currentPenId ? envData.hum : undefined,
            }))}
            currentPenId={currentPenId}
            onSelectPen={(pId) => {
              setCurrentPenId(pId);
              currentPenIdRef.current = pId;
              loadPenData(pId);
            }}
            onOpenAddPenModal={() => setModalOpen({ ...modalOpen, addPen: true })}
          />

          {dashboardTab === 'home' && (
            <>
              {/* B. Pinned Breaking Alert Card */}
              {!dismissedAlert && currentPenIssues.length > 0 && (
                <FeedAlertPinned
                  penName={currentPen.name}
                  penId={currentPenId}
                  issues={currentPenIssues}
                  temp={envData.temp}
                  smell={envData.smell}
                  currentMode={currentMode}
                  onActivateFan={async () => {
                    if (currentMode === 'cultivation') {
                      alert('Đã kích hoạt hệ thống tưới phun sương làm mát vườn!');
                      const waterDev = devices.find((d) => 
                        d.name.toLowerCase().includes('phun') || 
                        d.name.toLowerCase().includes('bơm') || 
                        d.name.toLowerCase().includes('tưới')
                      );
                      if (waterDev) handleToggleDevice(waterDev.id, false);
                    } else {
                      alert('Đã kích hoạt quạt thông gió làm mát chuồng!');
                      const fanDev = devices.find((d) => d.name.toLowerCase().includes('quạt'));
                      if (fanDev) handleToggleDevice(fanDev.id, false);
                    }
                  }}
                  onDismiss={() => setDismissedAlert(true)}
                  onAskAI={() => setIsMessengerOpen(true)}
                />
              )}

              {/* C. Tin mới & Bản tin tổng hợp */}
              <FeedBriefingCard
                onOpenChat={() => setIsMessengerOpen(true)}
                pendingTasksCount={newsfeedCounts?.pending ?? 2}
                lowStockCount={newsfeedCounts?.lowStock ?? inventory.filter((i) => i.quantity <= 5).length}
                sickAnimalsCount={
                  newsfeedCounts?.sick ?? (
                    currentMode === 'livestock'
                      ? animals.filter((a) => a.feeding_status === 'Anorexic' || a.status === 'Sick').length
                      : crops.filter((c) => (c.status || '').toLowerCase().includes('care') || (c.status || '').toLowerCase().includes('sick') || (c.status || '').toLowerCase().includes('dry')).length
                  )
                }
                briefingText={briefingText}
                onTriggerBriefing={handleTriggerBriefing}
                isLoading={isBriefingLoading || isNewsfeedLoading}
                currentMode={currentMode}
                newsfeedItems={newsfeedItems}
                onRefreshNewsfeed={() => loadNewsfeed()}
                onQuickAction={handleNewsfeedQuickAction}
              />

              {/* D. Con vật & Cây trồng */}
              <div id="section-livestock-crops">
                <FeedLivestockCrops
                  currentMode={currentMode}
                  animals={animals}
                  crops={crops}
                  penName={currentPen.name}
                  onOpenAddModal={() =>
                    currentMode === 'livestock'
                      ? setModalOpen({ ...modalOpen, addAnimal: true })
                      : setModalOpen({ ...modalOpen, addCrop: true })
                  }
                  onExportAnimal={handleExportAnimal}
                  onExportCrop={handleExportCrop}
                  logs={inventoryLogs}
                  onOpenTracking={async (animalId) => {
                    setSelectedAnimalId(animalId);
                    selectedAnimalIdRef.current = animalId;
                    const { data } = await supabase.from('weight_logs').select('*').eq('animal_id', animalId);
                    setAnimalWeightLogs(data || [{ weight: 20 }, { weight: 25 }]);
                    setModalOpen({ ...modalOpen, weight: true });
                  }}
                  onOpenHealth={async (animalId) => {
                    setSelectedAnimalId(animalId);
                    selectedAnimalIdRef.current = animalId;
                    const { data } = await supabase.from('health_logs').select('*').eq('animal_id', animalId);
                    setAnimalHealthLogs(data || []);
                    setModalOpen({ ...modalOpen, health: true });
                  }}
                  onDeleteAnimal={async (animalId) => {
                    if (confirm('Bạn có chắc muốn xóa hồ sơ vật nuôi này?')) {
                      const activePen = currentPenIdRef.current;
                      setAnimals((prev) => prev.filter((a) => String(a.id).trim().toLowerCase() !== String(animalId).trim().toLowerCase()));
                      await supabase.from('animals').delete().eq('id', animalId);
                      if (activePen) await loadPenData(activePen);
                      showRealtimeNotification('animals', `Đã xóa hồ sơ cá thể ${animalId}`);
                    }
                  }}
                  onOpenCropTracking={async (cropId) => {
                    setSelectedCropId(cropId);
                    selectedCropIdRef.current = cropId;
                    const { data } = await supabase.from('crop_growth_logs').select('*').eq('crop_id', cropId);
                    setCropGrowthLogs(data || []);
                    setModalOpen({ ...modalOpen, cropTrack: true });
                  }}
                  onOpenCropCare={async (cropId) => {
                    setSelectedCropId(cropId);
                    selectedCropIdRef.current = cropId;
                    const { data } = await supabase.from('crop_care_logs').select('*').eq('crop_id', cropId);
                    setCropCareLogs(data || []);
                    setModalOpen({ ...modalOpen, cropCare: true });
                  }}
                  onDeleteCrop={async (cropId) => {
                    if (confirm('Bạn có chắc muốn xóa vụ mùa cây trồng này?')) {
                      const activePen = currentPenIdRef.current;
                      setCrops((prev) => prev.filter((c) => String(c.id).trim().toLowerCase() !== String(cropId).trim().toLowerCase()));
                      await supabase.from('crops').delete().eq('id', cropId);
                      if (activePen) await loadPenData(activePen);
                      showRealtimeNotification('crops', `Đã xóa vụ mùa cây trồng`);
                    }
                  }}
                />
              </div>
            </>
          )}

          {dashboardTab === 'operations' && (
            <>
              {/* E. Realtime Environment Monitor */}
              <div id="section-env">
                <FeedEnvMonitor
                  penName={currentPen.name}
                  penId={currentPenId}
                  currentMode={currentMode}
                  temp={envData.temp}
                  hum={envData.hum}
                  smell={envData.smell}
                  historyLogs={historyLogs}
                  onRefresh={() => loadPenData(currentPenIdRef.current)}
                  onOpenChat={() => setIsMessengerOpen(true)}
                />
              </div>

              {/* F. Camera Giám Sát & AI Action Tracking */}
              <div id="section-camera">
                <FeedPenCamera
                  currentPenId={currentPenId}
                  penName={currentPen.name}
                  penCameraUrl={currentPen.camera_url}
                  penWebcamUrl={currentPen.webcam_url}
                  currentMode={currentMode}
                  onOpenConfigCamera={() => setModalOpen({ ...modalOpen, configCamera: true })}
                  onNotification={(title, desc) => showRealtimeNotification('action_vision', desc)}
                />
              </div>

              {/* G. Staff Attendance & Face Scan */}
              <FeedStaffAttendance
                currentPenId={currentPenId}
                penName={currentPen.name}
                onNotification={(title, desc) => showRealtimeNotification('staff', desc)}
              />

              {/* H. Inventory Feed Post */}
              <div id="section-inventory">
                <FeedInventory
                  items={inventory}
                  logs={inventoryLogs}
                  pens={pens}
                  currentMode={currentMode}
                  onOpenImport={() => setModalOpen({ ...modalOpen, importInv: true })}
                  onOpenExport={() => setModalOpen({ ...modalOpen, exportInv: true })}
                />
              </div>
            </>
          )}
        </main>

        {/* Right Column: IoT Switches & Activity Stream (Hiển thị ở Trang đầu) */}
        {dashboardTab === 'home' && (
          <RightSidebar
            devices={devices}
            penName={currentPen.name}
            currentMode={currentMode}
            onToggleDevice={handleToggleDevice}
            onOpenAddDeviceModal={() => setModalOpen({ ...modalOpen, addDevice: true })}
          />
        )}
      </div>
      )}

      {/* 3. Floating Messenger Chat Bubble */}
      <MessengerChatBubble
        penId={currentPenId}
        penName={currentPen.name}
        isOpen={isMessengerOpen}
        onToggle={() => setIsMessengerOpen(!isMessengerOpen)}
        temp={envData.temp}
        hum={envData.hum}
        smell={envData.smell}
        userId={activeUserId || 'guest'}
      />

      {/* 4. Modals */}
      <ModalAddPen
        isOpen={modalOpen.addPen}
        onClose={() => setModalOpen({ ...modalOpen, addPen: false })}
        onAdd={async (type, id, name, cameraUrl, webcamUrl) => {
          const userId = activeUserIdRef.current;
          const newPen = {
            id,
            name,
            type,
            ...(cameraUrl ? { camera_url: cameraUrl } : {}),
            webcam_url: webcamUrl || '0',
            ...(userId ? { user_id: userId } : {})
          };
          setPens((prev) => [...prev, newPen]);
          try {
            await supabase.from('pens').insert([newPen]);
          } catch {}
          try {
            await fetch(`${BACKEND_URL}/api/pens`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newPen),
            });
          } catch (e) {
            console.error('Pen API sync error:', e);
          }
          setCurrentPenId(id);
          currentPenIdRef.current = id;
          await fetchPens();
          await loadPenData(id);
          showRealtimeNotification('pens', `Đã tạo khu vực mới: ${name}`);
        }}
      />

      <ModalConfigCamera
        isOpen={modalOpen.configCamera}
        onClose={() => setModalOpen({ ...modalOpen, configCamera: false })}
        penId={currentPenId}
        penName={currentPen.name}
        initialCameraUrl={currentPen.camera_url}
        initialWebcamUrl={currentPen.webcam_url}
        onSave={async (cameraUrl, webcamUrl) => {
          await handleUpdatePenCameras(currentPenId, cameraUrl, webcamUrl);
        }}
      />

      <ModalAddDevice
        isOpen={modalOpen.addDevice}
        onClose={() => setModalOpen({ ...modalOpen, addDevice: false })}
        onAdd={async (id, name, pin) => {
          const activePen = currentPenIdRef.current;
          const newDev = { id, name, pin_number: pin, is_active: false, pen_id: activePen };
          setDevices((prev) => [...prev, { ...newDev, pin }]);
          await supabase.from('devices').insert([newDev]);
          if (activePen) await loadPenData(activePen);
          showRealtimeNotification('devices', `Đã thêm thiết bị mới: ${name}`);
        }}
      />

      <ModalAddAnimal
        isOpen={modalOpen.addAnimal}
        onClose={() => setModalOpen({ ...modalOpen, addAnimal: false })}
        onAdd={async (id, species, weight, targetWeight) => {
          const activePen = currentPenIdRef.current;
          const newAni = { id, species, weight, target_weight: targetWeight, pen_id: activePen, status: 'Khoe' };
          setAnimals((prev) => [...prev, newAni]);
          await supabase.from('animals').insert([newAni]);
          if (activePen) await loadPenData(activePen);
          showRealtimeNotification('animals', `Đã thêm cá thể mới: ${id} (${species})`);
        }}
      />

      <ModalHealth
        isOpen={modalOpen.health}
        onClose={() => setModalOpen({ ...modalOpen, health: false })}
        animalId={selectedAnimalId}
        logs={animalHealthLogs}
        onAddLog={async (type, action, note) => {
          const targetAnimalId = selectedAnimalIdRef.current;
          const newLog = { animal_id: targetAnimalId, type, title: action, note, created_at: new Date().toISOString() };
          setAnimalHealthLogs((prev) => [newLog, ...prev]);
          await supabase.from('health_logs').insert([newLog]);
          const { data } = await supabase.from('health_logs').select('*').eq('animal_id', targetAnimalId);
          if (data) setAnimalHealthLogs(data);
          showRealtimeNotification('health_logs', `Đã thêm nhật ký thú y`);
        }}
        onDeleteLog={async (logId) => {
          const targetAnimalId = selectedAnimalIdRef.current;
          setAnimalHealthLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
          await supabase.from('health_logs').delete().eq('id', logId);
          const { data } = await supabase.from('health_logs').select('*').eq('animal_id', targetAnimalId);
          if (data) setAnimalHealthLogs(data);
        }}
      />

      <ModalWeightTracking
        isOpen={modalOpen.weight}
        onClose={() => setModalOpen({ ...modalOpen, weight: false })}
        animalId={selectedAnimalId}
        logs={animalWeightLogs}
        onSaveWeight={async (weight) => {
          const targetAnimalId = selectedAnimalIdRef.current;
          const activePen = currentPenIdRef.current;
          const newLog = { animal_id: targetAnimalId, weight: Number(weight), created_at: new Date().toISOString() };
          setAnimalWeightLogs((prev) => [...prev, newLog]);
          setAnimals((prev) => prev.map((a) => (String(a.id) === String(targetAnimalId) ? { ...a, weight: Number(weight) } : a)));
          await supabase.from('weight_logs').insert([newLog]);
          await supabase.from('animals').update({ weight: Number(weight) }).eq('id', targetAnimalId);
          if (activePen) await loadPenData(activePen);
          showRealtimeNotification('weight_logs', `Đã cập nhật cân nặng mới: ${weight} kg`);
        }}
        onDeleteWeight={async (logId) => {
          const targetAnimalId = selectedAnimalIdRef.current;
          setAnimalWeightLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
          await supabase.from('weight_logs').delete().eq('id', logId);
          const { data } = await supabase.from('weight_logs').select('*').eq('animal_id', targetAnimalId);
          if (data) setAnimalWeightLogs(data);
          showRealtimeNotification('weight_logs', `Đã xóa mốc cân`);
        }}
      />

      <ModalImport
        isOpen={modalOpen.importInv}
        onClose={() => setModalOpen({ ...modalOpen, importInv: false })}
        onImport={async (category, name, quantity, unit, price) => {
          const existing = inventory.find((i) => i.name.toLowerCase().trim() === name.toLowerCase().trim());
          if (existing) {
            const updatedQty = Number(existing.quantity) + Number(quantity);
            setInventory((prev) => prev.map((i) => (String(i.id) === String(existing.id) ? { ...i, quantity: updatedQty } : i)));
            await supabase.from('inventory').update({ quantity: updatedQty }).eq('id', existing.id);
          } else {
            // Không truyền cột 'id' vì 'id' là GENERATED ALWAYS AS IDENTITY trong PostgreSQL
            const newItem = {
              name,
              category: category || 'Feed',
              quantity: Number(quantity),
              unit: unit || 'kg',
              unit_price: Number(price) || 0,
              user_id: activeUserIdRef.current || null,
            };
            await supabase.from('inventory').insert([newItem]);
          }
          await recordOperationLog(
            'IMPORT',
            name,
            Number(quantity),
            null,
            `Nhập kho (${category === 'Feed' ? 'Thức ăn' : category === 'Fertilizer' ? 'Phân bón' : 'Vật tư khác'}) • Đơn vị: ${unit || 'kg'} • Đơn giá: ${Number(price || 0).toLocaleString('vi-VN')} đ`
          );
          await fetchInventory();
          showRealtimeNotification('inventory', `Đã nhập kho ${quantity} ${unit} ${name}`);
        }}
      />

      <ModalExport
        isOpen={modalOpen.exportInv}
        onClose={() => setModalOpen({ ...modalOpen, exportInv: false })}
        inventoryItems={inventory}
        pens={pens}
        onExport={async (itemId, qty, penId, note) => {
          const item = inventory.find((i) => String(i.id) === String(itemId));
          if (item) {
            const updatedQty = Math.max(0, Number(item.quantity) - Number(qty));
            setInventory((prev) => prev.map((i) => (String(i.id) === String(itemId) ? { ...i, quantity: updatedQty } : i)));
            await supabase.from('inventory').update({ quantity: updatedQty }).eq('id', item.id);
            // Bảng feed_logs có các cột: pen_id, food_name, amount
            await supabase.from('feed_logs').insert([{ pen_id: penId, food_name: item.name, amount: Number(qty) }]);
            await recordOperationLog(
              'EXPORT',
              item.name,
              Number(qty),
              penId || null,
              note ? `${note} (${item.unit})` : `Xuất dùng ${qty} ${item.unit}`
            );
            await fetchInventory();
            showRealtimeNotification('inventory', `Đã xuất kho ${qty} ${item.unit} ${item.name} cho chuồng ${penId}`);
          }
        }}
      />

      <ModalAddCrop
        isOpen={modalOpen.addCrop}
        onClose={() => setModalOpen({ ...modalOpen, addCrop: false })}
        onAdd={async (name, quantity, date, expectedHarvest) => {
          const activePen = currentPenIdRef.current;
          // Bảng crops dùng cột 'plant_date', 'harvest_date' và 'id' tự tăng
          const newCrop = {
            name,
            quantity: Number(quantity),
            plant_date: date || new Date().toISOString().split('T')[0],
            harvest_date: expectedHarvest || null,
            pen_id: activePen,
          };
          await supabase.from('crops').insert([newCrop]);
          if (activePen) await loadPenData(activePen);
          showRealtimeNotification('crops', `Đã thêm cây trồng mới: ${name}`);
        }}
      />

      <ModalCropTracking
        isOpen={modalOpen.cropTrack}
        onClose={() => setModalOpen({ ...modalOpen, cropTrack: false })}
        cropId={selectedCropId}
        logs={cropGrowthLogs}
        onSaveGrowth={async (size) => {
          const targetCropId = selectedCropIdRef.current;
          const newLog = { crop_id: targetCropId, height_or_size: Number(size), created_at: new Date().toISOString() };
          setCropGrowthLogs((prev) => [...prev, newLog]);
          await supabase.from('crop_growth_logs').insert([newLog]);
          showRealtimeNotification('crop_growth_logs', `Đã cập nhật tăng trưởng cây trồng: ${size} cm`);
        }}
        onDeleteGrowth={async (logId) => {
          setCropGrowthLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
          await supabase.from('crop_growth_logs').delete().eq('id', logId);
          showRealtimeNotification('crop_growth_logs', `Đã xóa mốc đo tăng trưởng`);
        }}
      />

      <ModalCropCare
        isOpen={modalOpen.cropCare}
        onClose={() => setModalOpen({ ...modalOpen, cropCare: false })}
        cropId={selectedCropId}
        logs={cropCareLogs}
        onAddCare={async (type, note, action) => {
          const targetCropId = selectedCropIdRef.current;
          const newLog = { crop_id: targetCropId, type, note, action: action || '', created_at: new Date().toISOString() };
          setCropCareLogs((prev) => [newLog, ...prev]);
          await supabase.from('crop_care_logs').insert([newLog]);
          showRealtimeNotification('crop_care_logs', `Đã ghi nhật ký chăm sóc: ${action || type}`);
        }}
        onDeleteCare={async (logId) => {
          setCropCareLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
          await supabase.from('crop_care_logs').delete().eq('id', logId);
          showRealtimeNotification('crop_care_logs', `Đã xóa ghi chép chăm sóc`);
        }}
      />
      {/* 5. Live Realtime Notification Toast (F5-Free Instant Sync) */}
      {realtimeToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900/95 backdrop-blur text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/60 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-sm">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
            ⚡
          </div>
          <div className="min-w-0">
            <span className="font-bold text-emerald-400 block text-[11px] uppercase tracking-wider">
              Cập Nhật Tự Động • Thời Gian Thực
            </span>
            <span className="text-slate-200 text-xs block truncate mt-0.5">
              {realtimeToast.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
