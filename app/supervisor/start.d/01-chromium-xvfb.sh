#!/usr/bin/env bash
# ============================================================================
# Chromium - Xvfb 虚拟显示 (DISPLAY :0)
# ============================================================================

Xvfb ${CHROMIUM_DISPLAY} -ac -screen 0 ${VNC_RESOLUTION}'x24' -nolisten unix
