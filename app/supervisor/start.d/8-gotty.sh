#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.profile

if [ "${IF_TERMINAL_ON}" = "true" ]
then

if [ ".${TERMINAL_RPOXY}" != "." ]
then
cat >> ~/.profile << EOF
alias p="export ALL_PROXY=${TERMINAL_RPOXY};export HTTP_PROXY=${TERMINAL_RPOXY};HTTPS_PROXY=${TERMINAL_RPOXY}"
alias up="unset ALL_PROXY;unset HTTP_PROXY;unset HTTPS_PROXY"
EOF
fi
[ ".${TERMINAL_USER}" != "." ] && [ ".${TERMINAL_PASSWORD}" != "." ] && OPTS="-c ${TERMINAL_USER}:${TERMINAL_PASSWORD}"
echo "${TERMINAL_ONCE}" | grep -i '^true$' &> /dev/null && OPTS="${OPTS} --once"
source ~/.profile
INFO "/app/gotty/gotty -w -p 2222 ${OPTS} /bin/bash -l"
/app/gotty/gotty -w -p 2222 ${OPTS} /bin/bash -l

else
SLEEP_INFITY $0
fi
