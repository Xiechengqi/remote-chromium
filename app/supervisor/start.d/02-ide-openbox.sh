#!/usr/bin/env bash
# ============================================================================
# Antigravity IDE - Openbox 窗口管理器 (DISPLAY :1)
# ============================================================================

if [ "${IF_IDE_ON}" != "true" ]
then
  source /app/supervisor/start.d/common.sh
  SLEEP_INFITY $0
fi

DISPLAY=${IDE_DISPLAY} openbox-session
