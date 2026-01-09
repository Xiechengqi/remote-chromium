#!/usr/bin/env bash
# ============================================================================
# CCSwitch - KasmVNC (Web 端口 7700)
# ============================================================================

source /app/supervisor/start.d/common.sh

if [ "${IF_CCSWITCH_ON}" != "true" ]
then
  SLEEP_INFITY $0
fi

SESSION_NAME="ccswitch"
INSTALL_MARKER="/tmp/kasmvnc.installed"

DISPLAY="${CCSWITCH_DISPLAY:-:12}"
WEB_PORT="${CCSWITCH_NOVNC_PORT:-7700}"
VIEW_ONLY="${NOVNC_VIEW_ONLY:-false}"

KASMVNC_USER="user"
KASMVNC_PASSWORD="${CCSWITCH_NOVNC_PASSWORD:-}"
KASMVNC_HTTPD_DIR="/usr/share/kasmvnc/www"
KASMVNC_INTERFACE="0.0.0.0"
KASMVNC_DEPTH="24"
KASMVNC_FRAME_RATE="24"

if [ ".${KASMVNC_PASSWORD}" = "." ]
then
  KASMVNC_PASSWORD="kasmvnc"
  YELLOW "CCSWITCH_NOVNC_PASSWORD is empty; defaulting KasmVNC password to '${KASMVNC_PASSWORD}'"
fi

for i in {1..300}
do
  [ -f "${INSTALL_MARKER}" ] && break
  INFO "Waiting for KasmVNC installation marker..."
  sleep 1
done

[ -f "${INSTALL_MARKER}" ] || ERROR "KasmVNC is not installed (missing ${INSTALL_MARKER})"
command -v vncserver &> /dev/null || ERROR "vncserver not found after install"
command -v vncpasswd &> /dev/null || ERROR "vncpasswd not found after install"

export HOME="/app/kasmvnc/${SESSION_NAME}"
mkdir -p "${HOME}/.vnc"

# Setup user/password and permissions (default is view-only)
VNC_PASS_OPTS=""
[ "${VIEW_ONLY}" = "true" ] || VNC_PASS_OPTS="-w"
printf "%s\n%s\n\n" "${KASMVNC_PASSWORD}" "${KASMVNC_PASSWORD}" | vncpasswd -u "${KASMVNC_USER}" ${VNC_PASS_OPTS} &> /dev/null

# Ensure display is not already running
vncserver -kill "${DISPLAY}" &> /dev/null || true

# Parse geometry from VNC_RESOLUTION (e.g. 1920x1080)
GEOMETRY="${VNC_RESOLUTION:-1920x1080}"

INFO "Starting CCSwitch KasmVNC..."
INFO "  DISPLAY=${DISPLAY}"
INFO "  WEB_PORT=${WEB_PORT}"
INFO "  VIEW_ONLY=${VIEW_ONLY}"

exec vncserver "${DISPLAY}" \
  -fg \
  -noxstartup \
  -ac \
  -depth "${KASMVNC_DEPTH}" \
  -geometry "${GEOMETRY}" \
  -websocketPort "${WEB_PORT}" \
  -FrameRate="${KASMVNC_FRAME_RATE}" \
  -interface "${KASMVNC_INTERFACE}" \
  -httpd "${KASMVNC_HTTPD_DIR}"
