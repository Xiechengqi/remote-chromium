#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH
source ./common.sh

source ~/.profile

if [ "${IF_GEMINI_ON}" = "true" ]
then

while :
do
source ~/.profile
INFO "npm -v" && ! npm -v && EXEC "sleep 1m" && continue
INFO "npm install -g @google/gemini-cli" && npm install -g @google/gemini-cli
done

else
SLEEP_INFITY $0
fi
