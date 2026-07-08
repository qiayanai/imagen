#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${IMAGEGEN_COMPOSE_PROJECT:-imagen}"
CONFIG_FILE="${IMAGEGEN_CONFIG_FILE:-$HOME/services/imagen/config/config.prod.env}"
DATA_DIR="${IMAGEGEN_DATA_DIR:-$HOME/services/imagen/data}"
LOG_DIR="${IMAGEGEN_LOG_DIR:-$HOME/services/imagen/logs}"
COMPOSE_FILE="$ROOT_DIR/deploy/compose.prod.yml"

usage() {
  cat <<'EOF'
Usage: deploy/prod.sh <command>

Commands:
  init-config   Create the production env file from the example only if missing.
  up            Build and start the Imagen backend.
  restart       Restart the Imagen backend.
  logs          Follow the persistent app log file.
  compose-logs  Follow container stdout/stderr logs.
  ps            Show compose service status.
  config        Render the compose config for validation.
  down          Stop the Imagen backend service.

Environment:
  IMAGEGEN_CONFIG_FILE       Absolute path to config.prod.env.
                             Default: $HOME/services/imagen/config/config.prod.env
  IMAGEGEN_DATA_DIR          Persistent data directory mounted to /var/lib/imagen.
                             Default: $HOME/services/imagen/data
  IMAGEGEN_LOG_DIR           Persistent log directory mounted to /var/log/imagen.
                             Default: $HOME/services/imagen/logs
  IMAGEGEN_COMPOSE_PROJECT   Compose project name. Default: imagen
  IMAGEGEN_BACKEND_BIND      Host bind address. Default: 127.0.0.1
  IMAGEGEN_BACKEND_PORT      Host port. Default: 8092
EOF
}

require_absolute_path() {
  local name="$1"
  local value="$2"
  case "$value" in
    /*) ;;
    *)
      echo "$name must be an absolute path: $value" >&2
      exit 1
      ;;
  esac
}

require_paths() {
  require_absolute_path IMAGEGEN_CONFIG_FILE "$CONFIG_FILE"
  require_absolute_path IMAGEGEN_DATA_DIR "$DATA_DIR"
  require_absolute_path IMAGEGEN_LOG_DIR "$LOG_DIR"
}

require_config_file() {
  require_paths
  if [[ -d "$CONFIG_FILE" ]]; then
    echo "Production config path is a directory, not a file: $CONFIG_FILE" >&2
    exit 1
  fi
  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Production config file is missing: $CONFIG_FILE" >&2
    echo "Run 'deploy/prod.sh init-config' once, then edit the file with real secrets." >&2
    exit 1
  fi
}

compose() {
  IMAGEGEN_CONFIG_FILE="$CONFIG_FILE" \
  IMAGEGEN_DATA_DIR="$DATA_DIR" \
  IMAGEGEN_LOG_DIR="$LOG_DIR" \
  podman compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

init_config() {
  require_paths
  if [[ -e "$CONFIG_FILE" ]]; then
    if [[ -d "$CONFIG_FILE" ]]; then
      echo "Refusing to overwrite directory at config path: $CONFIG_FILE" >&2
    else
      echo "Refusing to overwrite existing production config: $CONFIG_FILE" >&2
    fi
    exit 1
  fi

  mkdir -p "$(dirname "$CONFIG_FILE")" "$DATA_DIR" "$DATA_DIR/storage" "$DATA_DIR/engines" "$DATA_DIR/work" "$LOG_DIR"
  chmod 700 "$DATA_DIR/engines" || true
  umask 077
  cp "$ROOT_DIR/config.prod.env.example" "$CONFIG_FILE"
  echo "Created production config: $CONFIG_FILE"
  echo "Edit it before deploying. This script will never overwrite it."
}

prepare_dirs() {
  require_paths
  mkdir -p "$DATA_DIR" "$DATA_DIR/storage" "$DATA_DIR/engines" "$DATA_DIR/work" "$LOG_DIR"
  chmod 700 "$DATA_DIR/engines" || true
}

configured_log_file() {
  local configured
  configured="$(grep -E '^IMAGEGEN_LOG_FILE=' "$CONFIG_FILE" | tail -n 1 | cut -d= -f2- || true)"
  configured="${configured%\"}"
  configured="${configured#\"}"
  configured="${configured%\'}"
  configured="${configured#\'}"
  if [[ -z "$configured" ]]; then
    configured="/var/log/imagen/imagen-api.log"
  fi
  basename "$configured"
}

command="${1:-}"
case "$command" in
  init-config)
    init_config
    ;;
  up)
    require_config_file
    prepare_dirs
    podman network create kageos-hub-net >/dev/null 2>&1 || true
    compose up -d --build imagen-backend
    ;;
  restart)
    require_config_file
    compose restart imagen-backend
    ;;
  logs)
    require_config_file
    prepare_dirs
    log_file="$LOG_DIR/$(configured_log_file)"
    touch "$log_file"
    tail -n 200 -f "$log_file"
    ;;
  compose-logs)
    compose logs -f imagen-backend
    ;;
  ps)
    compose ps
    ;;
  config)
    require_config_file
    prepare_dirs
    compose config
    ;;
  down)
    require_paths
    compose down
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage >&2
    exit 1
    ;;
esac
