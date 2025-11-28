#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_CURSOR_ON}" = "true" ]
then

echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
INFO "tmux new-session -s cursor -d" && tmux new-session -s cursor -d 
INFO "curl -SsL https://cursor.com/install | bash && cursor-agent login"
tmux send-keys -t cursor:0 'curl -SsL https://cursor.com/install | bash && cursor-agent login' C-m
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
