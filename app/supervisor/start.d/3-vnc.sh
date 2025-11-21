#!/usr/bin/env bash

# NOVNC_PASSWORD
if [ ".${NOVNC_PASSWORD}" = "." ]
then
  # default
  echo "Starting VNC server without password authentication"
  X11VNC_OPTS=""
else
  X11VNC_OPTS="-usepw -rfbauth ${HOME}/.vnc-passwd"
  echo "Starting VNC server with custom password"
  x11vnc -storepasswd ${NOVNC_PASSWORD} ${HOME}/.vnc-passwd
fi

# VNC_VIEW_ONLY
if [ "${VNC_VIEW_ONLY}" = "true" ]; then
  echo "Starting VNC server with viewonly option"
  X11VNC_OPTS="${X11VNC_OPTS} -viewonly"
fi

x11vnc ${X11VNC_OPTS} -forever -alwaysshared -display ${DISPLAY} -geometry ${VNC_RESOLUTION} -rfbport ${VNC_PORT} -rfbportv6 ${VNC_PORT} -permitfiletransfer -noxrecord -noxfixes -dpms -desktop ${NOVNC_TITLE}
# x11vnc ${X11VNC_OPTS} -rfbport ${VNC_PORT} -display ${DISPLAY} -geometry ${VNC_RESOLUTION} -forever -alwaysshared -permitfiletransfer -noxrecord -noxfixes -noxdamage -dpms -desktop ${NOVNC_TITLE}
