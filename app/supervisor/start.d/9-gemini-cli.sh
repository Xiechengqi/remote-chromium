#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

if [ "${IF_GEMINI_ON}" = "true" ]
then

while :
do
source ~/.bashrc
INFO "npm -v" && ! npm -v && EXEC "sleep 1m" && continue
break
done
INFO "npm install -g @google/gemini-cli" && npm install -g @google/gemini-cli
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
