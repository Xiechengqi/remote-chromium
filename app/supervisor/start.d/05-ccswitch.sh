#!/usr/bin/env bash
# ============================================================================
# CCSwitch 浏览器启动脚本
# ============================================================================

source /app/supervisor/start.d/common.sh

if [ "${IF_CCSWITCH_ON}" = "true" ]
then

# 设置 DISPLAY
export DISPLAY=${CCSWITCH_DISPLAY}

# 等待 X11 Display 就绪
while ! xdpyinfo -display ${DISPLAY} &>/dev/null
do
INFO "Waiting for CCSwitch X server..."
EXEC "sleep 1"
done

# # 等待 claude、codex、gemini 就绪
# for i in {1..10}
# do
# source <(grep 'export NVM_DIR=' ~/.bashrc)
# [ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
# INFO "check /root/.local/bin/claude" && ! ls /root/.local/bin/claude && EXEC "sleep 1m" && continue
# INFO "check \${NVM_DIR}/versions/node/v*/bin/codex" && ! ls ${NVM_DIR}/versions/node/v*/bin/codex && EXEC "sleep 1m" && continue
# INFO "check \${NVM_DIR}/versions/node/v*/bin/gemini" && ! ls ${NVM_DIR}/versions/node/v*/bin/gemini && EXEC "sleep 1m" && continue
# break
# done

INFO "Installing CCSwitch ..."

EXEC "mkdir -p /app/cc-switch"
EXEC "cd /app/cc-switch"
uname -m | grep -E 'arm64|aarch64' &> /dev/null && EXEC "cp -f -v CC-Switch-Linux-arm64.deb CC-Switch-Linux.deb"
INFO "apt install -y ./CC-Switch-Linux.deb" && apt install -y ./CC-Switch-Linux.deb && INFO "[ok]"

INFO "Starting CCSwitch ..."

for i in {1..3}
do
# 启动 CCSwitch
set -x
cc-switch
EXEC "sleep 10"
ps aux | grep -v grep | grep cc-switch &> /dev/null && break
done

SLEEP_INFITY $0

else

SLEEP_INFITY $0

fi
