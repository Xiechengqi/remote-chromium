#!/usr/bin/env bash
# ============================================================================
# CCSwitch - NoVNC 代理 (端口 7700)
# ============================================================================

# 创建临时 HTML（替换标题）
export CCSWITCH_INDEX_DIR="/app/index-ccswitch"
mkdir -p ${CCSWITCH_INDEX_DIR}
cp -r ${NOVNC_WEB_INDEX}/* ${CCSWITCH_INDEX_DIR}/
sed -i "s#@NOVNC_TITLE#${CCSWITCH_NOVNC_TITLE}#g" ${CCSWITCH_INDEX_DIR}/vnc.html

# 启动 NoVNC 代理
/app/noVNC/utils/novnc_proxy \
  --web ${CCSWITCH_INDEX_DIR} \
  --listen ${CCSWITCH_NOVNC_PORT} \
  --vnc localhost:${CCSWITCH_VNC_PORT}
