#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

if [ "${IF_OPENCODE_CLI_ON}" = "true" ]
then

EXEC "mkdir -p /root/.opencode/{conf,share}"
EXEC "ln -fs /root/.opencode/conf /root/.config/opencode"
EXEC "ln -fs /root/.opencode/share /root/.local/share/opencode"

EXEC "curl -SsL https://opencode.ai/install -o /tmp/install-opencode.sh" && sed -i 's/^INSTALL_DIR=.*/INSTALL_DIR=\/usr\/local\/bin/' /tmp/install-opencode.sh
INFO "bash /tmp/install-opencode.sh" && bash /tmp/install-opencode.sh
! ls /usr/local/bin/opencode &> /dev/null && INFO "Install Fail ..." && SLEEP_INFITY $0
INFO "Install Success ... "
INFO "tmux new-session -s opencode -d" && tmux new-session -s opencode -d
INFO "tmux send-keys -t opencode:0 'cd /app && opencode auth list && opencode stats' C-m"
tmux send-keys -t opencode:0 'cd /app && opencode auth list && opencode stats' C-m

SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
