#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/data/api-server.pid"
LOG_FILE="$PROJECT_ROOT/logs/api-server.log"
BINARY_NAME="claudio-api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"

source_env() {
    [ -f "$PROJECT_ROOT/.env" ] && export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
}

get_port() {
    source_env
    echo "${CLAUDIO_PORT:-17280}"
}

get_pid() {
    [ -f "$PID_FILE" ] && cat "$PID_FILE"
}

is_running() {
    local pid=$(get_pid)
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

health_check() {
    curl -sf "http://localhost:$(get_port)/health" >/dev/null 2>&1
}

build_server() {
    echo -e "${GREEN}Building API server...${NC}"
    cd "$PROJECT_ROOT"
    cargo build --package claudio-api --release
    echo -e "${GREEN}Build complete${NC}"
}

start_server() {
    if is_running; then
        echo -e "${YELLOW}API server is already running (PID: $(get_pid))${NC}"
        return 0
    fi

    echo -e "${GREEN}Starting Claudio API server...${NC}"
    cd "$PROJECT_ROOT"
    source_env

    [ ! -f "target/release/$BINARY_NAME" ] && build_server

    nohup ./target/release/$BINARY_NAME >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    local port=$(get_port)
    echo -n "Waiting for server"
    for i in {1..30}; do
        sleep 2
        if ! is_running; then
            echo -e "\n${RED}Server process died. Check logs: $LOG_FILE${NC}"
            rm -f "$PID_FILE"
            return 1
        fi
        if health_check; then
            echo -e "\n${GREEN}API server started (PID: $(get_pid))${NC}"
            echo -e "URL: ${GREEN}http://localhost:$port${NC}"
            return 0
        fi
        echo -n "."
    done

    echo -e "\n${YELLOW}Server running but health check timed out${NC}"
}

stop_server() {
    if ! is_running; then
        echo -e "${YELLOW}API server is not running${NC}"
        rm -f "$PID_FILE"
        return 0
    fi

    local pid=$(get_pid)
    echo -e "${YELLOW}Stopping API server (PID: $pid)...${NC}"
    kill "$pid" 2>/dev/null

    for i in {1..10}; do
        is_running || break
        sleep 1
    done

    is_running && kill -9 "$pid" 2>/dev/null
    rm -f "$PID_FILE"
    echo -e "${GREEN}API server stopped${NC}"
}

status_server() {
    local port=$(get_port)
    if is_running; then
        echo -e "${GREEN}API server is running${NC}"
        echo "  PID: $(get_pid)"
        echo "  URL: http://localhost:$port"
        health_check && echo -e "  Health: ${GREEN}OK${NC}" || echo -e "  Health: ${RED}FAIL${NC}"
    else
        echo -e "${RED}API server is not running${NC}"
        return 1
    fi
}

case "${1:-status}" in
    start)   start_server ;;
    stop)    stop_server ;;
    restart) stop_server; sleep 1; start_server ;;
    rebuild) stop_server; build_server; sleep 1; start_server ;;
    status)  status_server ;;
    build)   build_server ;;
    logs)    tail -${2:-50} "$LOG_FILE" ;;
    *)       echo "Usage: $0 {start|stop|restart|rebuild|status|build|logs [lines]}" ;;
esac
