#!/usr/bin/env bash
# ============================================================================
# CCSwitch - X11VNC 服务器 (端口 5700)
# ============================================================================

# 密码认证
if [ ".${CCSWITCH_NOVNC_PASSWORD}" = "." ]
then
  echo "Starting CCSwitch VNC server without password"
  X11VNC_OPTS=""
else
  X11VNC_OPTS="-usepw -rfbauth ${HOME}/.vnc-passwd-ccswitch"
  echo "Starting CCSwitch VNC server with password"
  x11vnc -storepasswd ${CCSWITCH_NOVNC_PASSWORD} ${HOME}/.vnc-passwd-ccswitch
fi

# 只读模式
if [ "${NOVNC_VIEW_ONLY}" = "true" ]; then
  X11VNC_OPTS="${X11VNC_OPTS} -viewonly"
fi

# 启动 VNC 服务器
x11vnc ${X11VNC_OPTS} \
  -forever \
  -alwaysshared \
  -display ${CCSWITCH_DISPLAY} \
  -geometry ${VNC_RESOLUTION} \
  -rfbport ${CCSWITCH_VNC_PORT} \
  -rfbportv6 ${CCSWITCH_VNC_PORT} \
  -permitfiletransfer \
  -noxrecord \
  -noxfixes \
  -dpms \
  -desktop ${CCSWITCH_NOVNC_TITLE}
