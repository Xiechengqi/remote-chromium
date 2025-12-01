#!/usr/bin/env bash
# ============================================================================
# Antigravity IDE - Xvfb 虚拟显示 (DISPLAY :1)
# ============================================================================

Xvfb ${IDE_DISPLAY} -ac -screen 0 ${VNC_RESOLUTION}'x24' -nolisten unix
