#!/usr/bin/env bash

source ~/.profile

[ ".${TERMINAL_RPOXY}" != "." ] && export ALL_PROXY="${TERMINAL_RPOXY}"
[ ".${TERMINAL_USER}" != "." ] && [ ".${TERMINAL_PASSWORD}" != "." ] && OPTS="-c ${TERMINAL_USER}:${TERMINAL_PASSWORD}"
echo "${TERMINAL_ONCE}" | grep -i '^true$' &> /dev/null && OPTS="${OPTS} --once"
/app/gotty/gotty -w -p 2222 ${OPTS} /bin/bash
