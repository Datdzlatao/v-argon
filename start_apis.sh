#!/usr/bin/env bash

# Hệ Thống Smart Farm Multi-Pen & AI Vision
# Script khởi chạy riêng các API Backend & AI Vision (Background / Daemon Mode)
# Gồm 3 API độc lập:
#   1. Backend FastAPI (Port 8000)
#   2. Face Recognition & Uniform AI Engine (Port 8001)
#   3. Action Tracking & Motion AI Vision API (Port 8002 - Module new project)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

AI_PID_FILE="$LOG_DIR/ai_engine.pid"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
ACTION_PID_FILE="$LOG_DIR/action_vision.pid"

AI_LOG="$LOG_DIR/ai_engine.log"
BACKEND_LOG="$LOG_DIR/backend.log"
ACTION_LOG="$LOG_DIR/action_vision.log"

# Lấy PID đang chiếm cổng mạng
get_port_pids() {
    local port=$1
    lsof -ti :"$port" 2>/dev/null || fuser "$port"/tcp 2>/dev/null || true
}

# Giải phóng cổng mạng để chống xung đột (Address already in use)
free_port() {
    local port=$1
    local pids
    pids=$(get_port_pids "$port")
    if [ -n "$pids" ]; then
        echo "  ⚠️  Cổng $port đang bị chiếm bởi PID ($pids), đang giải phóng..."
        kill -15 $pids 2>/dev/null || true
        sleep 0.8
        pids=$(get_port_pids "$port")
        if [ -n "$pids" ]; then
            kill -9 $pids 2>/dev/null || true
            sleep 0.2
        fi
    fi
}

# Dừng tiến trình theo PID file
kill_pid_file() {
    local pid_file=$1
    local name=$2
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file" 2>/dev/null || true)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "  ⏹️  Đang dừng $name (PID: $pid)..."
            kill -15 "$pid" 2>/dev/null || true
            sleep 0.5
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
    fi
}

# Kiểm tra trạng thái cổng đang lắng nghe
is_port_listening() {
    local port=$1
    if ss -tlH "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
        return 0
    elif timeout 1 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Dừng tất cả các API
stop_apis() {
    echo "=========================================================="
    echo "🛑 Đang dừng 3 API Backend & AI Vision Engines..."
    echo "=========================================================="
    
    kill_pid_file "$ACTION_PID_FILE" "Action Vision Engine (8002)"
    kill_pid_file "$AI_PID_FILE" "AI Face/Uniform Engine (8001)"
    kill_pid_file "$BACKEND_PID_FILE" "Backend FastAPI (8000)"

    free_port 8002
    free_port 8001
    free_port 8000

    echo "🔄 Đang reset cấu hình Tailscale Funnel..."
    tailscale funnel reset >/dev/null 2>&1 || sudo tailscale funnel reset >/dev/null 2>&1 || true

    echo "✅ Đã tắt hoàn tất các API!"
    echo "=========================================================="
}

# Hiển thị trạng thái các API
show_status() {
    echo "=========================================================="
    echo "📊 TRẠNG THÁI CÁC API BACKEND & AI ENGINES (BACKGROUND)"
    echo "=========================================================="

    if is_port_listening 8000; then
        local pids
        pids=$(get_port_pids 8000 | tr '\n' ' ')
        echo "🟢 [Port 8000] Backend FastAPI:               ĐANG CHẠY (PID: $pids)"
    else
        echo "🔴 [Port 8000] Backend FastAPI:               ĐANG DỪNG"
    fi

    if is_port_listening 8001; then
        local pids
        pids=$(get_port_pids 8001 | tr '\n' ' ')
        echo "🟢 [Port 8001] AI Face/Uniform Engine:        ĐANG CHẠY (PID: $pids)"
    else
        echo "🔴 [Port 8001] AI Face/Uniform Engine:        ĐANG DỪNG"
    fi

    if is_port_listening 8002; then
        local pids
        pids=$(get_port_pids 8002 | tr '\n' ' ')
        echo "🟢 [Port 8002] Action Tracking Vision Engine: ĐANG CHẠY (PID: $pids)"
    else
        echo "🔴 [Port 8002] Action Tracking Vision Engine: ĐANG DỪNG"
    fi

    echo "----------------------------------------------------------"
    echo "🔗 Tailscale Funnel Status:"
    tailscale funnel status 2>/dev/null || sudo tailscale funnel status 2>/dev/null || echo "Tailscale offline hoặc chưa cấu hình"
    echo "=========================================================="
}

# Khởi chạy riêng AI Vision Engine (8001)
start_ai() {
    echo "🤖 Khởi động riêng AI Face/Uniform Engine (Port 8001) ngầm..."
    kill_pid_file "$AI_PID_FILE" "AI Engine cũ"
    free_port 8001

    setsid "$PROJECT_DIR/.venv/bin/uvicorn" api_server:app \
        --app-dir "$PROJECT_DIR/standalone_ai_engine" \
        --host 0.0.0.0 --port 8001 --reload \
        </dev/null > "$AI_LOG" 2>&1 &
    AI_PID=$!
    echo "$AI_PID" > "$AI_PID_FILE"
    disown "$AI_PID" 2>/dev/null || true

    sleep 2
    tailscale funnel --bg --yes --https=10000 8001 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=10000 8001 >/dev/null 2>&1 || true
    echo "✅ AI Face/Uniform Engine đã chạy ngầm trên port 8001 & Funnel 10000"
}

# Khởi chạy riêng Action & Motion Tracking Engine (8002)
start_action() {
    echo "🌾 Khởi động riêng Action & Motion Tracking API (Port 8002) ngầm..."
    kill_pid_file "$ACTION_PID_FILE" "Action Engine cũ"
    free_port 8002

    setsid "$PROJECT_DIR/.venv/bin/uvicorn" main:app \
        --app-dir "$PROJECT_DIR/new project" \
        --host 0.0.0.0 --port 8002 --reload \
        </dev/null > "$ACTION_LOG" 2>&1 &
    ACTION_PID=$!
    echo "$ACTION_PID" > "$ACTION_PID_FILE"
    disown "$ACTION_PID" 2>/dev/null || true

    sleep 2
    tailscale funnel --bg --yes --https=443 8002 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=443 8002 >/dev/null 2>&1 || true
    echo "✅ Action Tracking Vision API đã chạy ngầm trên port 8002 & Funnel 443"
}

# Khởi chạy riêng Backend FastAPI (8000)
start_backend() {
    echo "🚀 Khởi động riêng Backend FastAPI (Port 8000) ngầm..."
    kill_pid_file "$BACKEND_PID_FILE" "Backend cũ"
    free_port 8000

    setsid "$PROJECT_DIR/.venv/bin/uvicorn" app.main:app \
        --host 0.0.0.0 --port 8000 --reload \
        </dev/null > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    disown "$BACKEND_PID" 2>/dev/null || true

    sleep 3
    tailscale funnel --bg --yes --https=8443 8000 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=8443 8000 >/dev/null 2>&1 || true
    echo "✅ Backend FastAPI đã chạy ngầm trên port 8000 & Funnel 8443"
}

# Chờ 3 API sẵn sàng
wait_for_apis() {
    local max_wait=15
    local elapsed=0
    echo -n "⏳ Đang đợi 3 API khởi tạo"
    while [ $elapsed -lt $max_wait ]; do
        if is_port_listening 8001 && is_port_listening 8000 && is_port_listening 8002; then
            echo " [Sẵn sàng trong ${elapsed}s!]"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
        echo -n "."
    done
    echo " [Đã kiểm tra xong]"
}

# Khởi chạy cả 3 API
start_all_apis() {
    echo "=========================================================="
    echo "🌾 Khởi động 3 API Backend & AI Vision (Không chạy Frontend)"
    echo "🚀 CHẾ ĐỘ: BACKGROUND MODE (Tự động chống xung đột cổng)"
    echo "💡 Tối ưu cho hệ thống có Frontend chạy trên Vercel!"
    echo "=========================================================="

    # Bước 1: Dọn dẹp tiến trình cũ và giải phóng cổng 8000, 8001, 8002
    echo "🧹 [Bước 1/4] Kiểm tra và giải phóng cổng (8000, 8001, 8002)..."
    kill_pid_file "$ACTION_PID_FILE" "Action Vision Engine cũ"
    kill_pid_file "$AI_PID_FILE" "AI Face Engine cũ"
    kill_pid_file "$BACKEND_PID_FILE" "Backend cũ"
    free_port 8002
    free_port 8001
    free_port 8000

    # Bước 2: Khởi động Action Tracking Vision Engine ở background (Port 8002)
    echo "🤖 [Bước 2/4] Khởi động Action & Motion Tracking API (Port 8002) ngầm..."
    setsid "$PROJECT_DIR/.venv/bin/uvicorn" main:app \
        --app-dir "$PROJECT_DIR/new project" \
        --host 0.0.0.0 --port 8002 --reload \
        </dev/null > "$ACTION_LOG" 2>&1 &
    ACTION_PID=$!
    echo "$ACTION_PID" > "$ACTION_PID_FILE"
    disown "$ACTION_PID" 2>/dev/null || true

    # Bước 3: Khởi động AI Face/Uniform Engine ở background (Port 8001)
    echo "🤖 [Bước 3/4] Khởi động AI Face/Uniform Engine (Port 8001) ngầm..."
    setsid "$PROJECT_DIR/.venv/bin/uvicorn" api_server:app \
        --app-dir "$PROJECT_DIR/standalone_ai_engine" \
        --host 0.0.0.0 --port 8001 --reload \
        </dev/null > "$AI_LOG" 2>&1 &
    AI_PID=$!
    echo "$AI_PID" > "$AI_PID_FILE"
    disown "$AI_PID" 2>/dev/null || true

    # Bước 4: Khởi động Backend FastAPI ở background (Port 8000)
    echo "🚀 [Bước 4/4] Khởi động Backend FastAPI (Port 8000) ngầm..."
    setsid "$PROJECT_DIR/.venv/bin/uvicorn" app.main:app \
        --host 0.0.0.0 --port 8000 --reload \
        </dev/null > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    disown "$BACKEND_PID" 2>/dev/null || true

    # Đợi 3 API sẵn sàng
    wait_for_apis

    local v_ok="🔴 Khởi động chậm (Xem $AI_LOG)"
    local b_ok="🔴 Khởi động chậm (Xem $BACKEND_LOG)"
    local a_ok="🔴 Khởi động chậm (Xem $ACTION_LOG)"

    is_port_listening 8001 && v_ok="🟢 Đang lắng nghe (:8001)"
    is_port_listening 8000 && b_ok="🟢 Đang lắng nghe (:8000)"
    is_port_listening 8002 && a_ok="🟢 Đang lắng nghe (:8002)"

    # Khởi động Tailscale Funnel cho các API
    echo "🔗 Đang kết nối Tailscale Funnel..."
    tailscale funnel reset >/dev/null 2>&1 || sudo tailscale funnel reset >/dev/null 2>&1 || true
    tailscale funnel --bg --yes --https=443 8002 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=443 8002 >/dev/null 2>&1 || true
    tailscale funnel --bg --yes --https=8443 8000 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=8443 8000 >/dev/null 2>&1 || true
    tailscale funnel --bg --yes --https=10000 8001 >/dev/null 2>&1 || sudo tailscale funnel --bg --yes --https=10000 8001 >/dev/null 2>&1 || true

    echo ""
    echo "🎉 3 API ĐÃ SẴN SÀNG Ở CHẾ ĐỘ NỀN (BACKGROUND):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 ĐỊA CHỈ NỘI BỘ (LOCAL):"
    echo "👉 Backend API & Docs (FastAPI):       http://localhost:8000/docs [$b_ok]"
    echo "👉 Web Dashboard (FastAPI):            http://localhost:8000"
    echo "👉 WebSocket Endpoint:                 ws://localhost:8000/ws"
    echo "👉 Standalone AI Face & Uniform:       http://localhost:8001     [$v_ok]"
    echo "👉 Action & Motion Tracking API:       http://localhost:8002     [$a_ok]"
    echo "👉 Action Dashboard (new project):     http://localhost:8002"
    echo "👉 Video Feed Chuồng/Vườn (IP Cam):    http://localhost:8002/video_feed?target_id=123"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 ĐỊA CHỈ TAILSCALE FUNNEL (PUBLIC CHO VERCEL GỌI VỀ):"
    echo "👉 API Action & IP Cam (HTTPS 443):    https://dat-latitude-5590-2.tail2bda46.ts.net"
    echo "👉 API Agent Backend (HTTPS 8443):     https://dat-latitude-5590-2.tail2bda46.ts.net:8443"
    echo "👉 API Quét Khuôn Mặt (HTTPS 10000):   https://dat-latitude-5590-2.tail2bda46.ts.net:10000"
    echo "👉 Swagger Docs Action Vision:         https://dat-latitude-5590-2.tail2bda46.ts.net/docs"
    echo "👉 Swagger Docs Agent:                 https://dat-latitude-5590-2.tail2bda46.ts.net:8443/docs"
    echo "👉 Swagger Docs Quét Mặt:              https://dat-latitude-5590-2.tail2bda46.ts.net:10000/docs"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 THEO DÕI NHẬT KÝ (LOGS REALTIME):"
    echo "  • Action Vision: tail -f logs/action_vision.log"
    echo "  • Face AI:       tail -f logs/ai_engine.log"
    echo "  • Backend:       tail -f logs/backend.log"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚙️  LỆNH ĐIỀU KHIỂN:"
    echo "  • Kiểm tra trạng thái: ./start_apis.sh status"
    echo "  • Tắt 3 API:           ./stop_apis.sh  (hoặc ./start_apis.sh stop)"
    echo "  • Khởi động lại:       ./start_apis.sh restart"
    echo "  • Chạy riêng Backend:  ./start_apis.sh backend"
    echo "  • Chạy riêng Face AI:  ./start_apis.sh ai"
    echo "  • Chạy riêng Action:   ./start_apis.sh action"
    echo "=========================================================="
    echo "💡 Terminal đã được giải phóng. 3 API đang chạy ngầm an toàn để phục vụ Vercel & IP Cam!"
}

# Điều hướng tham số dòng lệnh
ACTION="${1:-start}"
case "$ACTION" in
    start)
        start_all_apis
        ;;
    backend)
        start_backend
        ;;
    ai)
        start_ai
        ;;
    action|motion)
        start_action
        ;;
    stop)
        stop_apis
        ;;
    restart)
        stop_apis
        sleep 1
        start_all_apis
        ;;
    status)
        show_status
        ;;
    *)
        echo "Cách dùng: $0 {start|backend|ai|action|stop|restart|status}"
        echo "  - Không tham số hoặc 'start': Khởi động cả 3 API (8000, 8001, 8002)"
        echo "  - 'backend': Khởi động riêng Backend FastAPI (Port 8000)"
        echo "  - 'ai': Khởi động riêng AI Face/Uniform Engine (Port 8001)"
        echo "  - 'action': Khởi động riêng Action & Motion Tracking API (Port 8002)"
        echo "  - 'stop': Tắt cả 3 API"
        echo "  - 'status': Xem trạng thái các API"
        exit 1
        ;;
esac
