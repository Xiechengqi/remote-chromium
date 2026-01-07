#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

if [ "${IF_TERMINAL_ON}" = "true" ]
then

if [ ".${TERMINAL_PROXY}" != "." ]
then
cat >> ~/.bashrc << EOF
alias p="export ALL_PROXY=${TERMINAL_PROXY};export HTTP_PROXY=${TERMINAL_PROXY};HTTPS_PROXY=${TERMINAL_PROXY}"
alias up="unset ALL_PROXY;unset HTTP_PROXY;unset HTTPS_PROXY"
EOF
fi
[ ".${TERMINAL_USER}" != "." ] && [ ".${TERMINAL_PASSWORD}" != "." ] && OPTS="-c ${TERMINAL_USER}:${TERMINAL_PASSWORD}"
echo "${TERMINAL_ONCE}" | grep -i '^true$' &> /dev/null && OPTS="${OPTS} --once"
echo "${TERMINAL_ALERT}" | grep -i '^true$' &> /dev/null && OPTS="${OPTS} --enable-idle-alert"
source ~/.bashrc
INFO "/usr/local/bin/gotty -w -p 2222 ${OPTS} /bin/bash"
/usr/local/bin/gotty -w -p 2222 ${OPTS} /bin/bash

else
SLEEP_INFITY $0
fi
