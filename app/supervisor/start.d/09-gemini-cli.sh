#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_GEMINI_CLI_ON}" = "true" ]
then

for i in {1..10}
do
source <(grep 'export NVM_DIR=' ~/.bashrc)
[ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
INFO "check \${NVM_DIR}/versions/node/v*/bin/npm" && ! ls ${NVM_DIR}/versions/node/v*/bin/npm && EXEC "sleep 1m" && continue
break
done

INFO "tmux new-session -s gemini -d" && tmux new-session -s gemini -d 
INFO "npm -v && npm install -g @google/gemini-cli && NO_BROWSER=true gemini"
tmux send-keys -t gemini:0 'npm -v && npm cache clean --force; npm -v && npm install -g @google/gemini-cli && NO_BROWSER=true gemini' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
