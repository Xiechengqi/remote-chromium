#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH
source ./common.sh

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
INFO "/app/gotty/gotty -w -p 2222 ${OPTS} /bin/bash"
/app/gotty/gotty -w -p 2222 ${OPTS} /bin/bash

else
SLEEP_INFITY $0
fi
