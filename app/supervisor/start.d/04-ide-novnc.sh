#!/usr/bin/env bash
# ============================================================================
# Antigravity IDE - NoVNC 代理 (端口 7800)
# ============================================================================

# 创建临时 HTML（替换标题）
IDE_INDEX_DIR="/app/index-ide"
mkdir -p ${IDE_INDEX_DIR}
cp -r ${NOVNC_WEB_INDEX}/* ${IDE_INDEX_DIR}/
sed -i "s#@NOVNC_TITLE#${IDE_NOVNC_TITLE}#g" ${IDE_INDEX_DIR}/vnc.html

# 启动 NoVNC 代理
/app/noVNC/utils/novnc_proxy \
  --web ${IDE_INDEX_DIR} \
  --listen ${IDE_NOVNC_PORT} \
  --vnc localhost:${IDE_VNC_PORT}
