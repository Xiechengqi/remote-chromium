#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_CLAUDE_REACT_GRAB_SERVER_ON}" = "true" ]
then

for i in {1..10}
do
source <(grep 'export NVM_DIR=' ~/.bashrc)
[ ".${NVM_DIR}" = "." ] && EXEC "sleep 1m" && continue
INFO "check \${NVM_DIR}/versions/node/v*/bin/npm" && ! ls ${NVM_DIR}/versions/node/v*/bin/npm && EXEC "sleep 1m" && continue
break
done

export NPM=$(ls ${NVM_DIR}/versions/node/v*/bin/npm)
export AGENT="claude-code"
export PORT="4567"

INFO "tmux new-session -s ${AGENT}-react -d" && tmux new-session -s ${AGENT}-react -d
INFO "${NPM} install -g @react-grab/${AGENT} && PORT=${PORT} react-grab-${AGENT}"
tmux send-keys -t ${AGENT}-react:0 "npm install -g @react-grab/${AGENT} && PORT=${PORT} react-grab-${AGENT}" C-m

SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
