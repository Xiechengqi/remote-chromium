#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_VIBE_KANBAN_ON}" = "true" ]
then

for i in {1..10}
do
source <(grep 'export NVM_DIR=' ~/.bashrc)
[ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
INFO "check \${NVM_DIR}/versions/node/v*/bin/npm" && ! ls ${NVM_DIR}/versions/node/v*/bin/npm && EXEC "sleep 1m" && continue
break
done

INFO "tmux new-session -s vibe-kanban -d" && tmux new-session -s vibe-kanban -d
INFO "npm -v && npm install -g vibe-kanban && HOST=0.0.0.0 PORT=7800 vibe-kanban"
tmux send-keys -t vibe-kanban:0 'npm -v && npm cache clean --force; npm -v && npm install -g vibe-kanban && HOST=0.0.0.0 PORT=7600 vibe-kanban' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
