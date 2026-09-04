#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

trim_trailing_slash() {
  printf "%s" "${1%/}"
}

make_origin() {
  local scheme="$1"
  local host="$2"
  local port="${3:-}"

  host="${host%.}"
  if [[ -n "$port" ]]; then
    printf "%s://%s:%s" "$scheme" "$host" "$port"
    return 0
  fi

  printf "%s://%s" "$scheme" "$host"
}

origin_with_api_path() {
  printf "%s/api/" "$(trim_trailing_slash "$1")"
}

replace_origin_port() {
  local origin
  local from_port
  local to_port

  origin="$(trim_trailing_slash "$1")"
  from_port="$2"
  to_port="$3"

  case "$origin" in
    *":${from_port}") printf "%s:%s" "${origin%:${from_port}}" "$to_port" ;;
    *) printf "%s" "$origin" ;;
  esac
}

csv_unique() {
  local result=""
  local item

  for item in "$@"; do
    item="$(trim_trailing_slash "$item")"
    [[ -z "$item" ]] && continue
    case ",${result}," in
      *",${item},"*) ;;
      *)
        if [[ -n "$result" ]]; then
          result="${result},${item}"
        else
          result="$item"
        fi
        ;;
    esac
  done

  printf "%s" "$result"
}

is_tsnet_host() {
  case "${1%.}" in
    *.ts.net) return 0 ;;
    *) return 1 ;;
  esac
}

first_lan_ip() {
  if command_exists ip; then
    local route
    route="$(ip -4 route get 1.1.1.1 2>/dev/null || true)"
    set -- $route
    while [[ $# -gt 0 ]]; do
      if [[ "$1" == "src" && -n "${2:-}" ]]; then
        printf "%s" "$2"
        return 0
      fi
      shift
    done
  fi

  if command_exists hostname; then
    for ip in $(hostname -I 2>/dev/null || true); do
      case "$ip" in
        127.*|169.254.*) ;;
        *.*) printf "%s" "$ip"; return 0 ;;
      esac
    done
  fi

  printf "127.0.0.1"
}

detect_python() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    printf "%s" "$PYTHON_BIN"
    return 0
  fi

  if [[ -x "${ROOT_DIR}/.venv/bin/python" ]]; then
    printf "%s" "${ROOT_DIR}/.venv/bin/python"
    return 0
  fi

  if [[ -x "${ROOT_DIR}/venv/bin/python" ]]; then
    printf "%s" "${ROOT_DIR}/venv/bin/python"
    return 0
  fi

  printf "python3"
}

detect_tailscale_host() {
  if [[ -n "${TAILSCALE_HOST:-}" ]]; then
    printf "%s" "${TAILSCALE_HOST%.}"
    return 0
  fi

  if ! command_exists tailscale; then
    return 0
  fi

  local dns_name
  dns_name="$(
    tailscale status --json 2>/dev/null |
      "$PYTHON_BIN" -c 'import json,sys
try:
    value=json.load(sys.stdin).get("Self", {}).get("DNSName", "")
    print(value.rstrip("."))
except Exception:
    pass
' 2>/dev/null || true
  )"
  if [[ -n "$dns_name" ]]; then
    printf "%s" "$dns_name"
    return 0
  fi

  local tailscale_ip
  tailscale_ip="$(tailscale ip -4 2>/dev/null | sed -n '1p' || true)"
  if [[ -n "$tailscale_ip" ]]; then
    printf "%s" "$tailscale_ip"
  fi
}

APP_HOST="${APP_HOST:-$(first_lan_ip)}"
APP_SCHEME="${APP_SCHEME:-http}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
NPM_BIN="${NPM_BIN:-npm}"
PYTHON_BIN="$(detect_python)"

APP_ORIGIN="${APP_ORIGIN:-${APP_SCHEME}://${APP_HOST}:${FRONTEND_PORT}}"
API_ORIGIN="${API_ORIGIN:-${APP_SCHEME}://${APP_HOST}:${BACKEND_PORT}}"

APP_ORIGIN="$(trim_trailing_slash "$APP_ORIGIN")"
API_ORIGIN="$(trim_trailing_slash "$API_ORIGIN")"
APP_URL="${APP_ORIGIN}/"
LOCAL_API_BASE_URL="$(origin_with_api_path "$API_ORIGIN")"

TAILSCALE_HOST="$(detect_tailscale_host)"
TAILSCALE_APP_ORIGIN=""
TAILSCALE_API_ORIGIN_VALUE=""
if [[ -n "${TAILSCALE_ORIGIN:-}" ]]; then
  TAILSCALE_APP_ORIGIN="$(trim_trailing_slash "$TAILSCALE_ORIGIN")"
elif [[ -n "$TAILSCALE_HOST" ]]; then
  TAILSCALE_SCHEME="${TAILSCALE_SCHEME:-}"
  if [[ -z "$TAILSCALE_SCHEME" ]]; then
    if is_tsnet_host "$TAILSCALE_HOST"; then
      TAILSCALE_SCHEME="https"
    else
      TAILSCALE_SCHEME="$APP_SCHEME"
    fi
  fi

  if [[ -z "${TAILSCALE_FRONTEND_PORT+x}" ]]; then
    if [[ "$TAILSCALE_SCHEME" == "https" ]] && is_tsnet_host "$TAILSCALE_HOST"; then
      TAILSCALE_FRONTEND_PORT=""
    else
      TAILSCALE_FRONTEND_PORT="$FRONTEND_PORT"
    fi
  fi

  TAILSCALE_APP_ORIGIN="$(make_origin "$TAILSCALE_SCHEME" "$TAILSCALE_HOST" "$TAILSCALE_FRONTEND_PORT")"
fi

if [[ -n "$TAILSCALE_APP_ORIGIN" ]]; then
  if [[ -n "${TAILSCALE_API_ORIGIN:-}" ]]; then
    TAILSCALE_API_ORIGIN_VALUE="$(trim_trailing_slash "$TAILSCALE_API_ORIGIN")"
  elif [[ "$TAILSCALE_APP_ORIGIN" == https://*.ts.net ]]; then
    TAILSCALE_API_ORIGIN_VALUE="$TAILSCALE_APP_ORIGIN"
  else
    TAILSCALE_API_ORIGIN_VALUE="$(
      replace_origin_port "$TAILSCALE_APP_ORIGIN" "$FRONTEND_PORT" "$BACKEND_PORT"
    )"
  fi
fi

TAILSCALE_APP_URL=""
TAILSCALE_API_BASE_URL=""
if [[ -n "$TAILSCALE_APP_ORIGIN" ]]; then
  TAILSCALE_APP_URL="${TAILSCALE_APP_ORIGIN}/"
  TAILSCALE_API_BASE_URL="$(origin_with_api_path "$TAILSCALE_API_ORIGIN_VALUE")"
fi

DEFAULT_INSTALL_URLS="$(csv_unique "$APP_URL" "$TAILSCALE_APP_URL")"
DEFAULT_API_BASE_URLS="$(csv_unique "$TAILSCALE_API_BASE_URL" "$LOCAL_API_BASE_URL")"
PRIMARY_APP_URL="${TAILSCALE_APP_URL:-$APP_URL}"

export VITE_INSTALL_URLS="${INSTALL_URLS:-$DEFAULT_INSTALL_URLS}"
export VITE_API_BASE_URL="${API_BASE_URL:-$DEFAULT_API_BASE_URLS}"

QR_BIN="${FRONTEND_DIR}/node_modules/.bin/qrcode"

echo "Pregatesc aplicatia pentru instalare pe iPhone si Android..."
echo "Frontend local:     ${APP_URL}"
if [[ -n "$TAILSCALE_APP_URL" ]]; then
  echo "Frontend Tailscale: ${TAILSCALE_APP_URL}"
else
  echo "Frontend Tailscale: nesetat"
fi
echo "API-uri:            ${VITE_API_BASE_URL}"
echo ""

if [[ "$APP_HOST" == "127.0.0.1" ]]; then
  echo "Nu am detectat IP-ul din retea."
  echo "Ruleaza din nou cu APP_HOST=IP-ul-raspberry-pi, de exemplu:"
  echo "  APP_HOST=192.168.1.20 ./scripts/mobile-install.sh"
  echo ""
fi

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
  echo "Instalez dependintele frontend..."
  (cd "$FRONTEND_DIR" && "$NPM_BIN" install)
fi

echo "Generez build-ul PWA..."
(cd "$FRONTEND_DIR" && "$NPM_BIN" run build)

if [[ -x "$QR_BIN" ]]; then
  "$QR_BIN" -t svg -w 420 -q 4 -o "${FRONTEND_DIR}/dist/install-qr.svg" "$PRIMARY_APP_URL"
  "$QR_BIN" -t svg -w 420 -q 4 -o "${FRONTEND_DIR}/dist/install-qr-local.svg" "$APP_URL"
  if [[ -n "$TAILSCALE_APP_URL" ]]; then
    "$QR_BIN" -t svg -w 420 -q 4 -o "${FRONTEND_DIR}/dist/install-qr-tailscale.svg" "$TAILSCALE_APP_URL"
  fi
fi

if [[ "${RUN_COLLECTSTATIC:-1}" == "1" ]]; then
  echo "Colectez fisierele statice Django..."
  (cd "$BACKEND_DIR" && "$PYTHON_BIN" manage.py collectstatic --noinput)
fi

echo ""
echo "Aplicatia este pregatita pentru instalare:"
echo "  Local:     ${APP_URL}"
if [[ -n "$TAILSCALE_APP_URL" ]]; then
  echo "  Tailscale: ${TAILSCALE_APP_URL}"
fi
echo ""

if command_exists qrencode; then
  qrencode -t ANSIUTF8 "$PRIMARY_APP_URL"
elif [[ -x "$QR_BIN" ]]; then
  "$QR_BIN" "$PRIMARY_APP_URL"
else
  echo "Optional: instaleaza 'qrencode' sau ruleaza npm install ca scriptul sa afiseze cod QR in terminal."
fi

if [[ -f "${FRONTEND_DIR}/dist/install-qr.svg" ]]; then
  echo "QR principal generat la: ${FRONTEND_DIR}/dist/install-qr.svg"
  echo "QR local generat la:     ${FRONTEND_DIR}/dist/install-qr-local.svg"
  if [[ -n "$TAILSCALE_APP_URL" ]]; then
    echo "QR Tailscale generat la: ${FRONTEND_DIR}/dist/install-qr-tailscale.svg"
  fi
fi

echo ""
echo "iPhone: deschide linkul in Safari, apasa Partajare, apoi Adaugare pe ecranul principal."
echo "Android: deschide linkul in Chrome si foloseste Instaleaza aplicatia sau Adauga pe ecranul principal."

case "$APP_URL" in
  https://*|http://localhost/*|http://127.0.0.1/*)
    echo "Biometrie/passkeys: origin sigur detectat."
    ;;
  *)
    echo "Biometrie/passkeys: pentru Face ID real foloseste HTTPS, de exemplu Tailscale HTTPS sau un certificat local."
    ;;
esac
