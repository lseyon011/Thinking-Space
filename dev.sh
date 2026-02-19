#!/usr/bin/env bash
# dev.sh — start/stop the full Thinking Space stack
# Usage:
#   ./dev.sh start       Start backend + frontend dev servers
#   ./dev.sh start -e    Start backend + frontend + Electron
#   ./dev.sh stop        Stop all running services
#   ./dev.sh status      Show what's running
#   ./dev.sh logs        Tail all log files

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_DIR="$ROOT_DIR/.dev-pids"
LOG_DIR="$ROOT_DIR/.dev-logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ── Helpers ──

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }

is_running() {
  local pidfile="$PID_DIR/$1.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pidfile"
  fi
  return 1
}

stop_service() {
  local name="$1"
  local pidfile="$PID_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      cyan "Stopping $name (pid $pid)..."
      kill "$pid" 2>/dev/null || true
      # Wait up to 5 seconds for graceful shutdown
      for i in $(seq 1 10); do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.5
      done
      # Force kill if still alive
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      green "  $name stopped."
    else
      cyan "  $name (pid $pid) already dead."
    fi
    rm -f "$pidfile"
  else
    cyan "  $name not running."
  fi
}

# ── Commands ──

cmd_start() {
  local with_electron=false
  if [ "${1:-}" = "-e" ] || [ "${1:-}" = "--electron" ]; then
    with_electron=true
  fi

  # Backend
  if is_running backend; then
    cyan "Backend already running (pid $(cat "$PID_DIR/backend.pid"))"
  else
    cyan "Starting backend..."
    cd "$BACKEND_DIR"
    # Activate pyenv virtualenv
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)" 2>/dev/null || true
    eval "$(pyenv virtualenv-init -)" 2>/dev/null || true
    pyenv activate ltmpilot_venv 2>/dev/null || true

    uvicorn app.main:app --reload --port 8000 \
      > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"
    green "  Backend started (pid $!) — http://localhost:8000"
    green "  Log: $LOG_DIR/backend.log"
  fi

  if [ "$with_electron" = true ]; then
    # Electron mode: build frontend, sync, launch electron
    if is_running electron; then
      cyan "Electron already running (pid $(cat "$PID_DIR/electron.pid"))"
    else
      cyan "Starting Electron (builds frontend first)..."
      cd "$FRONTEND_DIR"
      npm run electron:dev \
        > "$LOG_DIR/electron.log" 2>&1 &
      echo $! > "$PID_DIR/electron.pid"
      green "  Electron started (pid $!)"
      green "  Log: $LOG_DIR/electron.log"
    fi
  else
    # Dev server mode: vite dev
    if is_running frontend; then
      cyan "Frontend already running (pid $(cat "$PID_DIR/frontend.pid"))"
    else
      cyan "Starting frontend dev server..."
      cd "$FRONTEND_DIR"
      npm run dev \
        > "$LOG_DIR/frontend.log" 2>&1 &
      echo $! > "$PID_DIR/frontend.pid"
      green "  Frontend started (pid $!) — http://localhost:5173"
      green "  Log: $LOG_DIR/frontend.log"
    fi
  fi

  echo ""
  green "All services started. Use './dev.sh stop' to shut down."
  green "Use './dev.sh logs' to tail output."
}

cmd_stop() {
  cyan "Stopping all services..."
  stop_service electron
  stop_service frontend
  stop_service backend
  echo ""
  green "All services stopped."
}

cmd_status() {
  echo ""
  for svc in backend frontend electron; do
    if is_running "$svc"; then
      green "  $svc: running (pid $(cat "$PID_DIR/$svc.pid"))"
    else
      red "  $svc: stopped"
    fi
  done
  echo ""
}

cmd_logs() {
  local files=()
  for f in "$LOG_DIR"/*.log; do
    [ -f "$f" ] && files+=("$f")
  done
  if [ ${#files[@]} -eq 0 ]; then
    cyan "No log files found."
    return
  fi
  tail -f "${files[@]}"
}

# ── Main ──

case "${1:-help}" in
  start)  shift; cmd_start "$@" ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  *)
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start       Start backend + frontend dev server"
    echo "  start -e    Start backend + Electron app"
    echo "  stop        Stop all running services"
    echo "  status      Show what's running"
    echo "  logs        Tail all log files"
    ;;
esac
