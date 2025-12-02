#!/usr/bin/env bash
# ============================================================================
# CCSwitch - Xvfb 虚拟显示 (DISPLAY :2)
# ============================================================================

Xvfb ${CCSWITCH_DISPLAY} -ac -screen 0 ${VNC_RESOLUTION}'x24' -nolisten unix
