#!/usr/bin/env bash
# ============================================================================
# Chromium - NoVNC 代理 (端口 7900)
# ============================================================================

# 创建临时 HTML（替换标题）
export CHROMIUM_INDEX_DIR="/app/index-chromium"
mkdir -p ${CHROMIUM_INDEX_DIR}
cp -r ${NOVNC_WEB_INDEX}/* ${CHROMIUM_INDEX_DIR}/
sed -i "s#@NOVNC_TITLE#${CHROMIUM_NOVNC_TITLE}#g" ${CHROMIUM_INDEX_DIR}/vnc.html

# 启动 NoVNC 代理
/app/noVNC/utils/novnc_proxy \
  --web ${CHROMIUM_INDEX_DIR} \
  --listen ${CHROMIUM_NOVNC_PORT} \
  --vnc localhost:${CHROMIUM_VNC_PORT}
