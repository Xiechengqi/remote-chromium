#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH
source ./common.sh

if [ "${IF_DUFS_ON}" = "true" ]
then
INFO "/app/dufs/dufs /app -A --port 5000"
/app/dufs/dufs /app -A --port 5000
else
SLEEP_INFITY $0
fi
