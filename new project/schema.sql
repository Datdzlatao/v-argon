-- ==============================================================================
-- DỰ ÁN NÔNG NGHIỆP THÔNG MINH V-ARGON
-- Phân hệ: Action Tracking & Hybrid AI Vision
-- File: schema.sql (Supabase / PostgreSQL)
-- ==============================================================================

-- Bật extension pgcrypto hoặc uuid-ossp nếu cần (Supabase đã tích hợp sẵn gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng lưu vết toàn bộ hoạt động canh tác nông nghiệp
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Loại hành động chăm sóc
    action_type TEXT NOT NULL CHECK (action_type IN ('WATERING', 'FEEDING', 'FERTILIZING')),
    
    -- Nguồn kích hoạt hành động
    trigger_source TEXT NOT NULL CHECK (trigger_source IN ('AUTO', 'MANUAL', 'AI_VISION')),
    
    -- Định danh khu vực / đối tượng (Ví dụ: 'GARDEN_01', 'PEN_01')
    target_id TEXT NOT NULL,
    
    -- Thời gian thực thi tính bằng giây (Có thể NULL nếu nhận diện từ AI_VISION)
    duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec >= 0),
    
    -- Trạng thái hoàn thành hoặc thất bại (đã qua kiểm chứng cảm biến/AI)
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    
    -- Ghi chú kiểm chứng: lý do từ Gemini VLM, độ chênh cảm biến, lỗi kỹ thuật
    confidence_note TEXT,
    
    -- Thời điểm ghi nhận log (UTC có múi giờ)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Chỉ mục tối ưu hóa cho truy vấn kiểm tra Cooldown (chống xung đột lệnh AUTO)
-- Truy vấn phổ biến: WHERE target_id = ? AND action_type = ? AND status = 'SUCCESS' AND created_at >= ?
CREATE INDEX IF NOT EXISTS idx_action_logs_cooldown 
ON public.action_logs (target_id, action_type, status, created_at DESC);

-- 3. Chỉ mục hỗ trợ thống kê theo thời gian và khu vực
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at 
ON public.action_logs (created_at DESC);

-- 4. Bật Row Level Security (RLS) theo chuẩn Supabase (tùy chọn)
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai hoặc qua service role
CREATE POLICY "Allow select for authenticated and anon" 
ON public.action_logs FOR SELECT 
USING (true);

-- Cho phép chèn bản ghi mới
CREATE POLICY "Allow insert for authenticated and anon" 
ON public.action_logs FOR INSERT 
WITH CHECK (true);

-- Chú thích tài liệu cho bảng và cột
COMMENT ON TABLE public.action_logs IS 'Bảng ghi vết hành động chăm sóc nông nghiệp V-ARGON';
COMMENT ON COLUMN public.action_logs.action_type IS 'Loại hành động: WATERING (Tưới nước), FEEDING (Cho ăn), FERTILIZING (Bón phân)';
COMMENT ON COLUMN public.action_logs.trigger_source IS 'Nguồn kích hoạt: AUTO (Tự động theo lịch/cảm biến), MANUAL (Bấm nút), AI_VISION (Camera AI phát hiện)';
COMMENT ON COLUMN public.action_logs.target_id IS 'Mã định danh luống cây, chuồng nuôi, khu vườn';
COMMENT ON COLUMN public.action_logs.duration_sec IS 'Thời lượng bơm/xả (giây). AI_VISION có thể để null';
COMMENT ON COLUMN public.action_logs.status IS 'Trạng thái: SUCCESS (Thành công), FAILED (Thất bại)';
COMMENT ON COLUMN public.action_logs.confidence_note IS 'Ghi chú đối chiếu từ cảm biến hoặc phản hồi từ Gemini VLM';
