#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_NPC_ON}" = "true" ]
then

for i in {1..10}
do
export localVerifyKey=$(cat /app/nps/conf/clients.json  | grep '"Id":34' | awk -F 'VerifyKey":"' '{print $NF}' | awk -F '"' '{print $1}')
[ ".${localVerifyKey}" != "." ] && break
INFO "localVerifyKey is ${localVerifyKey}, sleep 1m ..." && EXEC "sleep 1m"
done

if [ ".${localVerifyKey}" != "." ]
then
uname -m | grep -E 'arm64|aarch64' &> /dev/null && EXEC "cp -f -v /app/npc/npc-arm64 /app/npc/npc"
INFO "/app/npc/npc -server=localhost:8024 -vkey=${localVerifyKey} -type=tcp"
/app/npc/npc -server=localhost:8024 -vkey=${localVerifyKey} -type=tcp
fi

SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
