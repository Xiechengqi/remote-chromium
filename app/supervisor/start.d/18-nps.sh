#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_NPS_ON}" = "true" ]
then

EXEC "mkdir -p /etc/nps"
EXEC "ln -fs /app/nps/web /etc/nps/web"
INFO "/app/nps/nps"
/app/nps/nps

SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
