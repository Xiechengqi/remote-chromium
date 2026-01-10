#!/usr/bin/env bash
# ============================================================================
# Chromium - Openbox 窗口管理器 (DISPLAY :0)
# ============================================================================

source /app/supervisor/start.d/common.sh

export DISPLAY="${CHROMIUM_DISPLAY}"

# 等待 X11 Display 就绪
while ! xdpyinfo -display "${DISPLAY}" &>/dev/null
do
  INFO "Waiting for Chromium X server..."
  EXEC "sleep 1"
done

openbox-session
