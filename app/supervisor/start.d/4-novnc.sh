#!/usr/bin/env bash

sed -i "s#@NOVNC_TITLE#${NOVNC_TITLE}#g" /app/index/vnc.html
/app/noVNC/utils/novnc_proxy --web ${NOVNC_WEB_INDEX} --listen ${NOVNC_PORT} --vnc localhost:${VNC_PORT}
