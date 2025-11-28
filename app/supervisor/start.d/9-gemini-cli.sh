#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

if [ "${IF_GEMINI_ON}" = "true" ]
then

while :
do
source ~/.bashrc
INFO "ls ${NVM_DIR}/versions/node/v*/bin/npm" && ls ${NVM_DIR}/versions/node/v*/bin/npm && continue
break
done
INFO "npm cache clean --force" && npm cache clean --force
INFO "npm install -g @google/gemini-cli"
tmux new-session -d -s gemini 'source /root/.bashrc; p; npm install -g @google/gemini-cli'
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
