#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"
PID_FILE="$PROJECT_ROOT/data/dashboard.pid"
LOG_FILE="$PROJECT_ROOT/logs/dashboard.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"

# Load PORT from .env (Next.js uses PORT natively)
if [ -f "$PROJECT_ROOT/.env" ]; then
    PORT=$(grep -E "^PORT=" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
fi
PORT="${PORT:-17281}"

get_pid() {
    [ -f "$PID_FILE" ] && cat "$PID_FILE"
}

is_running() {
    local pid=$(get_pid)
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

health_check() {
    curl -sf "http://localhost:$PORT" >/dev/null 2>&1
}

check_pnpm() {
    command -v pnpm >/dev/null 2>&1 || {
        echo -e "${RED}pnpm not found. Install with: npm install -g pnpm${NC}"
        exit 1
    }
}

build_dashboard() {
    check_pnpm
    cd "$DASHBOARD_DIR"
    echo -e "${GREEN}Building dashboard...${NC}"
    [ ! -d "node_modules" ] && pnpm install
    pnpm build
    echo -e "${GREEN}Build complete${NC}"
}

start_server() {
    if is_running; then
        echo -e "${YELLOW}Dashboard is already running (PID: $(get_pid))${NC}"
        return 0
    fi

    check_pnpm
    echo -e "${GREEN}Starting Dashboard...${NC}"
    cd "$DASHBOARD_DIR"
    [ ! -d "node_modules" ] && pnpm install
    [ ! -d ".next" ] && pnpm build

    nohup pnpm start >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 3
    if is_running && health_check; then
        echo -e "${GREEN}Dashboard started (PID: $(get_pid))${NC}"
        echo -e "URL: ${GREEN}http://localhost:$PORT${NC}"
    elif is_running; then
        echo -e "${YELLOW}Dashboard started but health check failed${NC}"
    else
        echo -e "${RED}Failed to start dashboard. Check logs: $LOG_FILE${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

start_dev() {
    if is_running; then
        echo -e "${YELLOW}Dashboard is already running (PID: $(get_pid))${NC}"
        return 0
    fi

    check_pnpm
    echo -e "${GREEN}Starting Dashboard (dev mode)...${NC}"
    cd "$DASHBOARD_DIR"
    [ ! -d "node_modules" ] && pnpm install

    nohup pnpm dev >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 3
    if is_running; then
        echo -e "${GREEN}Dashboard dev server started (PID: $(get_pid))${NC}"
        echo -e "URL: ${GREEN}http://localhost:$PORT${NC}"
    else
        echo -e "${RED}Failed to start dashboard. Check logs: $LOG_FILE${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop_server() {
    if ! is_running; then
        echo -e "${YELLOW}Dashboard is not running${NC}"
        rm -f "$PID_FILE"
        return 0
    fi

    local pid=$(get_pid)
    echo -e "${YELLOW}Stopping Dashboard (PID: $pid)...${NC}"
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true

    for i in {1..10}; do
        is_running || break
        sleep 1
    done

    if is_running; then
        pkill -9 -P "$pid" 2>/dev/null || true
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    echo -e "${GREEN}Dashboard stopped${NC}"
}

status_server() {
    if is_running; then
        echo -e "${GREEN}Dashboard is running${NC}"
        echo "  PID: $(get_pid)"
        echo "  URL: http://localhost:$PORT"
        health_check && echo -e "  Health: ${GREEN}OK${NC}" || echo -e "  Health: ${RED}FAIL${NC}"
    else
        echo -e "${RED}Dashboard is not running${NC}"
        return 1
    fi
}

case "${1:-status}" in
    start)   start_server ;;
    dev)     start_dev ;;
    stop)    stop_server ;;
    restart) stop_server; sleep 1; start_server ;;
    rebuild) stop_server; rm -rf "$DASHBOARD_DIR/.next"; build_dashboard; sleep 1; start_server ;;
    status)  status_server ;;
    build)   build_dashboard ;;
    logs)    tail -${2:-50} "$LOG_FILE" ;;
    *)       echo "Usage: $0 {start|stop|restart|rebuild|status|dev|build|logs [lines]}" ;;
esac
