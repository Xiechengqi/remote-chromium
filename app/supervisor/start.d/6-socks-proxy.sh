#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_SOCKS_PROXY}" = "true" ]
then

export SOCKS_PORT="1080"
# SOCKS_PROXY=${SSH_IP}:${SSH_PORT}:${SSH_USER}:${SSH_PASSWORD}
[ ".${SOCKS_PROXY}" = "." ] && YELLOW "SOCKS_PROXY is None..." && SLEEP_INFITY $0

export SSH_IP=$(echo ${SOCKS_PROXY} | awk -F ':' '{print $1}')
export SSH_PORT=$(echo ${SOCKS_PROXY} | awk -F ':' '{print $2}')
export SSH_USER=$(echo ${SOCKS_PROXY} | awk -F ':' '{print $3}')
export SSH_PASSWORD=$(echo ${SOCKS_PROXY} | awk -F ':' '{print $4}')
INFO "try to ssh connect ${SOCKS_PROXY} ..."
! timeout 10 sshpass -p ${SSH_PASSWORD} ssh -p ${SSH_PORT} ${SSH_USER}@${SSH_IP} "hostname" &> /dev/null && YELLOW "[fail]" && SLEEP_INFITY $0

while :
do
if !  timeout 5 curl -x socks5://localhost:${SOCKS_PORT} https://checkip.amazonaws.com &> /dev/null || !  timeout 5 curl -x socks5://localhost:${SOCKS_PORT} 3.0.3.0 &> /dev/null || !  timeout 5 curl -x socks5://localhost:${SOCKS_PORT} 3.0.2.1 &> /dev/null || !  timeout 5 curl -x socks5://localhost:${SOCKS_PORT} httpbin.io/ip &> /dev/null
then
kill -9 $(ps axu | grep -v grep | grep ssh | grep ${SOCKS_PORT} | awk '{print $2}') || true
INFO "sshpass -p *** ssh -p ${SSH_PORT} -f -N -D *:${SOCKS_PORT} ${SSH_USER}@${SSH_IP}"
sshpass -p ${SSH_PASSWORD} ssh -p ${SSH_PORT} -f -N -D *:${SOCKS_PORT} ${SSH_USER}@${SSH_IP}
INFO "ss -plunt | grep ${SOCKS_PORT}" && ss -plunt | grep ${SOCKS_PORT}
fi
EXEC "sleep 1m"
done

else
SLEEP_INFITY $0
fi
