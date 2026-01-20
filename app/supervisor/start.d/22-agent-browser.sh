#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

if [ "${IF_AGENT_BROWSER_ON}" = "true" ]
then

EXEC "cd /app/agent-browser"
uname -m | grep -E 'arm64|aarch64' &> /dev/null && EXEC "cp -f -v agent-browser-arm64.tar.gz agent-browser.tar.gz"
EXEC "tar zxvf agent-browser.tar.gz --strip-components 1 -C ./"
EXEC "ln -fs /app/agent-browser/agent-browser /usr/local/bin/agent-browser"
INFO "which agent-browser" && which agent-browser
INFO "agent-browser -h" && agent-browser -h

SLEEP_INFITY $0
else
SLEEP_INFITY $0
fi
