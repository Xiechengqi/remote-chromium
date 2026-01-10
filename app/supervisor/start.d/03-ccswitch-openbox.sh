#!/usr/bin/env bash
# ============================================================================
# CCSwitch - Openbox 窗口管理器 (DISPLAY :0)
# ============================================================================

if [ "${IF_CCSWITCH_ON}" != "true" ]
then
  source /app/supervisor/start.d/common.sh
  SLEEP_INFITY $0
fi

source /app/supervisor/start.d/common.sh

export DISPLAY="${CCSWITCH_DISPLAY}"

# 等待 X11 Display 就绪
while ! xdpyinfo -display "${DISPLAY}" &>/dev/null
do
  INFO "Waiting for CCSwitch X server..."
  EXEC "sleep 1"
done

openbox-session
