#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH
source ./common.sh

source ~/.profile

if [ ".${IF_GEMINI_ON}" = "true" ]
then

INFO "nvm install ${NODE_VERSION}" && nvm install ${NODE_VERSION}
INFO "npm install -g @google/gemini-cli" && npm install -g @google/gemini-cli
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
