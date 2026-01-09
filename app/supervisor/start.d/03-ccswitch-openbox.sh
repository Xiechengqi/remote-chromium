#!/usr/bin/env bash
# ============================================================================
# CCSwitch - Openbox 窗口管理器 (DISPLAY :0)
# ============================================================================

if [ "${IF_CCSWITCH_ON}" != "true" ]
then
  source /app/supervisor/start.d/common.sh
  SLEEP_INFITY $0
fi

DISPLAY=${CCSWITCH_DISPLAY} openbox-session
