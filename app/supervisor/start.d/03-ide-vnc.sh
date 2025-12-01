#!/usr/bin/env bash
# ============================================================================
# Antigravity IDE - X11VNC 服务器 (端口 5800)
# ============================================================================

# 密码认证
if [ ".${IDE_NOVNC_PASSWORD}" = "." ]
then
  echo "Starting IDE VNC server without password"
  X11VNC_OPTS=""
else
  X11VNC_OPTS="-usepw -rfbauth ${HOME}/.vnc-passwd-ide"
  echo "Starting IDE VNC server with password"
  x11vnc -storepasswd ${IDE_NOVNC_PASSWORD} ${HOME}/.vnc-passwd-ide
fi

# 只读模式
if [ "${NOVNC_VIEW_ONLY}" = "true" ]; then
  X11VNC_OPTS="${X11VNC_OPTS} -viewonly"
fi

# 启动 VNC 服务器
x11vnc ${X11VNC_OPTS} \
  -forever \
  -alwaysshared \
  -display ${IDE_DISPLAY} \
  -geometry ${VNC_RESOLUTION} \
  -rfbport ${IDE_VNC_PORT} \
  -rfbportv6 ${IDE_VNC_PORT} \
  -permitfiletransfer \
  -noxrecord \
  -noxfixes \
  -dpms \
  -desktop ${IDE_NOVNC_TITLE}
