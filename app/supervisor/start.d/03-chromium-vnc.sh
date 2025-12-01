#!/usr/bin/env bash
# ============================================================================
# Chromium - X11VNC 服务器 (端口 5900)
# ============================================================================

# 密码认证
if [ ".${CHROMIUM_NOVNC_PASSWORD}" = "." ]
then
  echo "Starting Chromium VNC server without password"
  X11VNC_OPTS=""
else
  X11VNC_OPTS="-usepw -rfbauth ${HOME}/.vnc-passwd-chromium"
  echo "Starting Chromium VNC server with password"
  x11vnc -storepasswd ${CHROMIUM_NOVNC_PASSWORD} ${HOME}/.vnc-passwd-chromium
fi

# 只读模式
if [ "${NOVNC_VIEW_ONLY}" = "true" ]; then
  X11VNC_OPTS="${X11VNC_OPTS} -viewonly"
fi

# 启动 VNC 服务器
x11vnc ${X11VNC_OPTS} \
  -forever \
  -alwaysshared \
  -display ${CHROMIUM_DISPLAY} \
  -geometry ${VNC_RESOLUTION} \
  -rfbport ${CHROMIUM_VNC_PORT} \
  -rfbportv6 ${CHROMIUM_VNC_PORT} \
  -permitfiletransfer \
  -noxrecord \
  -noxfixes \
  -dpms \
  -desktop ${CHROMIUM_NOVNC_TITLE}
