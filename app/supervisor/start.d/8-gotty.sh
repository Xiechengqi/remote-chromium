#!/usr/bin/env bash

[ ".${TERMINAL_USER}" != "." ] && [ ".${TERMINAL_PASSWORD}" != "." ] && OPTS="-c ${TERMINAL_USER}:${TERMINAL_PASSWORD}"
[ ".${TERMINAL_RPOXY}" != "." ] && export ALL_PROXY="${TERMINAL_RPOXY}"
/app/gotty/gotty -w --once -p 2222 ${OPTS} /bin/bash
