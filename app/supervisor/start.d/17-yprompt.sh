#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh
export PATH="$HOME/.local/bin:$PATH"

if [ "${IF_YPROMPT_ON}" = "true" ]
then

export YPROMPT_PORT="8001"
export ADMIN_USERNAME=${YPROMPT_USERNAME}
export ADMIN_PASSWORD=${YPROMPT_PASSWORD}

INFO "ls /root/.local/bin/uv" && ls /root/.local/bin/uv
INFO "uv -V" && ! uv -V && SLEEP_INFITY $0
! ls /app/projects &> /dev/null && EXEC "mkdir -p /app/projects"
EXEC "cd /app"
! ls .venv/bin/activate &> /dev/null && EXEC "uv venv"
EXEC "source .venv/bin/activate"
! ls /app/projects/yprompt &> /dev/null && EXEC "git clone git@github.com:Xiechengqi/YPrompt.git /app/projects/yprompt"
EXEC "mkdir -p /app/projects/yprompt/data/logs/backend"
EXEC "cd /app/projects/yprompt/backend"
EXEC "uv pip install -r requirements.txt"
INFO "uv run run.py"
uv run run.py

else
SLEEP_INFITY $0
fi
