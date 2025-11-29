#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh
export PATH="$HOME/.local/bin:$PATH"

if [ "${IF_JUPYTER_ON}" = "true" ]
then

INFO "ls /root/.local/bin/uv" && ls /root/.local/bin/uv
INFO "uv -V" && ! uv -V && SLEEP_INFITY $0
export JUPYTER_PORT=8000
! ls /app/projects &> /dev/null && EXEC "mkdir -p /app/projects"
EXEC "cd /app"
EXEC "uv venv"
EXEC "source .venv/bin/activate"
EXEC "uv pip install jupyterlab"
INFO "jupyter lab --notebook-dir=/app/projects --allow-root --no-browser -y --ip 0.0.0.0"
jupyter lab --notebook-dir=/app/projects --allow-root --no-browser -y --ip 0.0.0.0

else
SLEEP_INFITY $0
fi
