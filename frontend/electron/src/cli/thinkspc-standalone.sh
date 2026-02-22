#!/usr/bin/env bash
# thinkspc-standalone — Standalone CLI wrapper bundled with the Electron app.
# Installed to /usr/local/bin/thinkspc (or equivalent) via the Electron app menu.
#
# This script resolves the bundled app's resources and runs the capability runner
# using the app's bundled Node.js and vite-node.

set -euo pipefail

# ── Resolve the Electron app resources directory ──

resolve_app_resources() {
  # 1. If THINKSPC_APP_RESOURCES is explicitly set, use it
  if [ -n "${THINKSPC_APP_RESOURCES:-}" ]; then
    echo "$THINKSPC_APP_RESOURCES"
    return
  fi

  # 2. macOS: look for the .app bundle in standard locations
  if [ "$(uname)" = "Darwin" ]; then
    local app_candidates=(
      "/Applications/Thinking Space.app"
      "$HOME/Applications/Thinking Space.app"
    )
    for app_path in "${app_candidates[@]}"; do
      local resources_path="$app_path/Contents/Resources"
      if [ -d "$resources_path/cli" ]; then
        echo "$resources_path"
        return
      fi
    done
  fi

  # 3. Linux: check common install paths
  if [ "$(uname)" = "Linux" ]; then
    local linux_candidates=(
      "/opt/Thinking Space/resources"
      "/usr/lib/thinking-space/resources"
      "$HOME/.local/share/Thinking Space/resources"
    )
    for resources_path in "${linux_candidates[@]}"; do
      if [ -d "$resources_path/cli" ]; then
        echo "$resources_path"
        return
      fi
    done
  fi

  echo "Error: Could not find Thinking Space app resources." >&2
  echo "Set THINKSPC_APP_RESOURCES to the app's Resources directory." >&2
  exit 1
}

APP_RESOURCES="$(resolve_app_resources)"
CLI_DIR="$APP_RESOURCES/cli"

# ── Load .env from the CLI resource dir or home config ──

if [ -f "$HOME/.config/thinkspc/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$HOME/.config/thinkspc/.env"
  set +a
fi

# Compatibility bridge — three env var names
: "${THINKSPC_VAULT_ROOT:=${LTM_VAULT_ROOT:-${THINK_SPACE_VAULT_ROOT:-}}}"
: "${LTM_VAULT_ROOT:=${THINKSPC_VAULT_ROOT:-}}"

export THINKSPC_VAULT_ROOT
export LTM_VAULT_ROOT
export LTM_AGENT_CAPABILITIES_ENABLED=1
export LTM_CAPABILITY_RUNNER_CLI=1

if [ -z "${THINKSPC_VAULT_ROOT:-}" ]; then
  echo "Error: THINKSPC_VAULT_ROOT is not set." >&2
  echo "Set it in ~/.config/thinkspc/.env or export it before running." >&2
  exit 1
fi

# ── Resolve the frontend directory from the bundled CLI resources ──

FRONTEND_DIR="$CLI_DIR/frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Error: Bundled frontend not found at $FRONTEND_DIR" >&2
  exit 1
fi

cd "$FRONTEND_DIR"
exec npx vite-node scripts/agent/capabilityRunner.ts "$@"
