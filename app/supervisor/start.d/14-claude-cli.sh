#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_CLAUDE_CLI_ON}" = "true" ]
then

for i in {1..10}
do
source <(grep 'export NVM_DIR=' ~/.bashrc)
[ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
INFO "check \${NVM_DIR}/versions/node/v*/bin/npm" && ! ls ${NVM_DIR}/versions/node/v*/bin/npm && EXEC "sleep 1m" && continue
break
done

INFO "npm -v && npm install -g @anthropic-ai/claude-code" && npm -v && npm install -g @anthropic-ai/claude-code
INFO "tmux new-session -s claude -d" && tmux new-session -s claude -d 
tmux send-keys -t claude:0 'ls ~/.claude/.claude.json && cp -f -v ~/.claude/.claude.json ~/; while : ;do cp -f -v ~/.claude.json ~/.claude/.claude.json; sleep 1m; done' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
