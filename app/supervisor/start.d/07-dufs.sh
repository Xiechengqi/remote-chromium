#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_DUFS_ON}" = "true" ]
then
INFO "/app/dufs/dufs /app -A --port 5000"
/app/dufs/dufs /app -A --port 5000
else
SLEEP_INFITY $0
fi
