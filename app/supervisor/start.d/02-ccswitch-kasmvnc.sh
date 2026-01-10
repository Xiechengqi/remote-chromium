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

# Skip desktop environment selection prompt
touch "${HOME}/.vnc/.de-was-selected"

# Configure kasmvnc to skip STUN query (avoid network timeout)
cat > "${HOME}/.vnc/kasmvnc.yaml" << 'YAML'
logging:
  log_writer_name: all
  log_dest: logfile
  level: 100

network:
  udp:
    public_ip: 127.0.0.1
YAML

# Set web client default settings (IME enabled, Remote Resizing mode)
KASMVNC_DEFAULTS_JS="${KASMVNC_HTTPD_DIR}/kasmvnc-defaults.js"
if [ ! -f "${KASMVNC_DEFAULTS_JS}" ]; then
  cat > "${KASMVNC_DEFAULTS_JS}" << 'JS'
(function() {
  var defaults = {
    'enable_ime': true,
    'resize': 'remote'
  };
  for (var key in defaults) {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify(defaults[key]));
    }
  }
})();
JS
  # Inject script into vnc.html if not already present
  if ! grep -q 'kasmvnc-defaults.js' "${KASMVNC_HTTPD_DIR}/vnc.html"; then
    sed -i 's|</head>|<script src="./kasmvnc-defaults.js"></script></head>|' "${KASMVNC_HTTPD_DIR}/vnc.html"
  fi
fi

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

# Start vncserver in background and wait for Xvnc process
vncserver "${DISPLAY}" \
  -fg \
  -noxstartup \
  -ac \
  -depth "${KASMVNC_DEPTH}" \
  -geometry "${GEOMETRY}" \
  -websocketPort "${WEB_PORT}" \
  -FrameRate="${KASMVNC_FRAME_RATE}" \
  -interface "${KASMVNC_INTERFACE}" \
  -httpd "${KASMVNC_HTTPD_DIR}" &

# Wait for Xvnc to start and keep script running
sleep 2
XVNC_PID=$(pgrep -f "Xvnc ${DISPLAY}" | head -1)
if [ -n "${XVNC_PID}" ]; then
  INFO "Xvnc started with PID ${XVNC_PID}"
  # Wait for Xvnc process to exit
  while kill -0 "${XVNC_PID}" 2>/dev/null; do
    sleep 5
  done
  ERROR "Xvnc process ${XVNC_PID} exited"
else
  ERROR "Failed to start Xvnc"
fi
