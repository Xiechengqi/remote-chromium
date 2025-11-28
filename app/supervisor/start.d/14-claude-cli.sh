#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_CLAUDE_ON}" = "true" ]
then

INFO "tmux new-session -s claude -d" && tmux new-session -s claude -d 
INFO "curl -fsSL https://claude.ai/install.sh | bash"
tmux send-keys -t claude:0 'curl -fsSL https://claude.ai/install.sh | bash' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
