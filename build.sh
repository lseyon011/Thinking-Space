#!/usr/bin/env bash
set -euo pipefail

# ─── Thinking Space Build Script ───
# Usage: ./build.sh [command]
#
# Commands:
#   dev            Start frontend dev server (default)
#   web            Build web/PWA bundle
#   electron       Build & launch Electron app
#   electron:pack  Package Electron app (unpacked, for testing)
#   mac            Package Electron .dmg for macOS
#   win            Package Electron .nsis for Windows
#   linux          Package Electron .AppImage for Linux
#   ios            Build for iOS and open Xcode
#   backend        Start FastAPI backend dev server
#   test           Run frontend tests
#   test:watch     Run frontend tests in watch mode
#   clean          Remove build artifacts
#   install        Install all dependencies
#   help           Show this help message

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ELECTRON_DIR="$FRONTEND_DIR/electron"
BACKEND_DIR="$ROOT_DIR/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}${BOLD}▸${NC} $*"; }
ok()    { echo -e "${GREEN}${BOLD}✓${NC} $*"; }
err()   { echo -e "${RED}${BOLD}✗${NC} $*" >&2; }

# ─── Dependency checks ───

check_node() {
  if ! command -v node &>/dev/null; then
    err "Node.js not found. Install it from https://nodejs.org"
    exit 1
  fi
}

check_npm() {
  if ! command -v npm &>/dev/null; then
    err "npm not found. Install Node.js from https://nodejs.org"
    exit 1
  fi
}

check_poetry() {
  if ! command -v poetry &>/dev/null; then
    err "Poetry not found. Install it: https://python-poetry.org/docs/#installation"
    exit 1
  fi
}

ensure_frontend_deps() {
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install)
    ok "Frontend dependencies installed"
  fi
}

ensure_electron_deps() {
  if [ ! -d "$ELECTRON_DIR/node_modules" ]; then
    info "Installing Electron dependencies..."
    (cd "$ELECTRON_DIR" && npm install)
    ok "Electron dependencies installed"
  fi
}

ensure_backend_deps() {
  if [ ! -d "$BACKEND_DIR/.venv" ] && [ ! -f "$BACKEND_DIR/poetry.lock" ] 2>/dev/null; then
    info "Installing backend dependencies..."
    (cd "$BACKEND_DIR" && poetry install)
    ok "Backend dependencies installed"
  fi
}

# ─── Commands ───

cmd_dev() {
  info "Starting frontend dev server..."
  check_node && check_npm
  ensure_frontend_deps
  (cd "$FRONTEND_DIR" && npm run dev)
}

cmd_web() {
  info "Building web bundle..."
  check_node && check_npm
  ensure_frontend_deps
  (cd "$FRONTEND_DIR" && npm run build:web)
  ok "Web build complete → frontend/dist/"
}

cmd_electron() {
  info "Building & launching Electron app..."
  check_node && check_npm
  ensure_frontend_deps
  ensure_electron_deps
  (cd "$FRONTEND_DIR" && npm run electron:dev)
}

cmd_electron_pack() {
  info "Packaging Electron app (unpacked)..."
  check_node && check_npm
  ensure_frontend_deps
  ensure_electron_deps
  (cd "$FRONTEND_DIR" && npm run electron:sync)
  (cd "$ELECTRON_DIR" && npm run electron:pack)
  ok "Electron pack complete"
}

cmd_mac() {
  info "Packaging Electron for macOS..."
  check_node && check_npm
  ensure_frontend_deps
  ensure_electron_deps
  (cd "$FRONTEND_DIR" && npm run package:mac)
  ok "macOS package complete"
}

cmd_win() {
  info "Packaging Electron for Windows..."
  check_node && check_npm
  ensure_frontend_deps
  ensure_electron_deps
  (cd "$FRONTEND_DIR" && npm run package:win)
  ok "Windows package complete"
}

cmd_linux() {
  info "Packaging Electron for Linux..."
  check_node && check_npm
  ensure_frontend_deps
  ensure_electron_deps
  (cd "$FRONTEND_DIR" && npm run package:linux)
  ok "Linux package complete"
}

cmd_ios() {
  info "Building for iOS..."
  check_node && check_npm
  ensure_frontend_deps
  (cd "$FRONTEND_DIR" && npm run package:ios)
  ok "iOS build synced — Xcode should open"
}

cmd_backend() {
  info "Starting backend dev server..."
  check_poetry
  ensure_backend_deps
  (cd "$BACKEND_DIR" && poetry run uvicorn app.main:app --reload --port 8000)
}

cmd_test() {
  info "Running frontend tests..."
  check_node && check_npm
  ensure_frontend_deps
  (cd "$FRONTEND_DIR" && npm test)
}

cmd_test_watch() {
  info "Running frontend tests (watch mode)..."
  check_node && check_npm
  ensure_frontend_deps
  (cd "$FRONTEND_DIR" && npm run test:watch)
}

cmd_clean() {
  info "Cleaning build artifacts..."
  rm -rf "$FRONTEND_DIR/dist"
  rm -rf "$ELECTRON_DIR/build"
  rm -rf "$ELECTRON_DIR/dist"
  rm -rf "$ELECTRON_DIR/app"
  ok "Clean complete"
}

cmd_install() {
  info "Installing all dependencies..."
  check_node && check_npm

  info "Frontend..."
  (cd "$FRONTEND_DIR" && npm install)

  info "Electron..."
  (cd "$ELECTRON_DIR" && npm install)

  if [ -d "$BACKEND_DIR" ]; then
    if command -v poetry &>/dev/null; then
      info "Backend..."
      (cd "$BACKEND_DIR" && poetry install)
    else
      info "Skipping backend (poetry not installed)"
    fi
  fi

  ok "All dependencies installed"
}

cmd_help() {
  echo ""
  echo -e "${BOLD}Thinking Space Build Script${NC}"
  echo ""
  echo "Usage: ./build.sh [command]"
  echo ""
  echo "Commands:"
  echo "  dev              Start frontend dev server (default)"
  echo "  web              Build web/PWA bundle"
  echo "  electron         Build & launch Electron app"
  echo "  electron:pack    Package Electron app (unpacked)"
  echo "  mac              Package .dmg for macOS"
  echo "  win              Package .nsis for Windows"
  echo "  linux            Package .AppImage for Linux"
  echo "  ios              Build for iOS and open Xcode"
  echo "  backend          Start FastAPI backend dev server"
  echo "  test             Run frontend tests"
  echo "  test:watch       Run frontend tests (watch mode)"
  echo "  clean            Remove build artifacts"
  echo "  install          Install all dependencies"
  echo "  help             Show this help"
  echo ""
}

# ─── Entrypoint ───

COMMAND="${1:-dev}"

case "$COMMAND" in
  dev)            cmd_dev ;;
  web)            cmd_web ;;
  electron)       cmd_electron ;;
  electron:pack)  cmd_electron_pack ;;
  mac)            cmd_mac ;;
  win)            cmd_win ;;
  linux)          cmd_linux ;;
  ios)            cmd_ios ;;
  backend)        cmd_backend ;;
  test)           cmd_test ;;
  test:watch)     cmd_test_watch ;;
  clean)          cmd_clean ;;
  install)        cmd_install ;;
  help|--help|-h) cmd_help ;;
  *)
    err "Unknown command: $COMMAND"
    cmd_help
    exit 1
    ;;
esac
