#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

INFO "tmux new-session -s monitor -d" && tmux new-session -s monitor -d 
tmux send-keys -t monitor:0 'cd /app/monitor && ./check.sh' C-m
SLEEP_INFITY $0
