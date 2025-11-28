#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_CODEX_ON}" = "true" ]
then

for i in {1..10}
do
source <(grep 'export NVM_DIR=' ~/.bashrc)
[ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
INFO "check \${NVM_DIR}/versions/node/v*/bin/npm" && ! ls ${NVM_DIR}/versions/node/v*/bin/npm && EXEC "sleep 1m" && continue
break
done

INFO "tmux new-session -s codex -d" && tmux new-session -s codex -d 
INFO "npm -v && npm install -g @openai/codex"
tmux send-keys -t codex:0 'npm -v && npm cache clean --force; npm -v && npm install -g @openai/codex' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
