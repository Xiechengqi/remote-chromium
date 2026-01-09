#!/usr/bin/env bash
# ============================================================================
# KasmVNC
# ============================================================================

source /app/supervisor/start.d/common.sh
source ~/.bashrc

INSTALL_MARKER="/tmp/kasmvnc.installed"

if command -v vncserver &> /dev/null && command -v vncpasswd &> /dev/null
then
  INFO "KasmVNC already installed"
else
  uname -m | grep -E 'arm64|aarch64' &> /dev/null && EXEC "cp -f -v /app/kasmvnc/kasmvncserver_1.4.0_arm64.deb /app/kasmvnc/kasmvncserver_1.4.0.deb"
  INFO "apt install -y -f /app/kasmvnc/kasmvncserver_1.4.0.deb"
  apt install -y -f /app/kasmvnc/kasmvncserver_1.4.0.deb
fi

EXEC "touch ${INSTALL_MARKER}"
INFO "KasmVNC install marker ready: ${INSTALL_MARKER}"
SLEEP_INFITY $0
