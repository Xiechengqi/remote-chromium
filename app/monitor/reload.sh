#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

function reload() {

scriptFilePath="$1"
echo -n "reload ${scriptFilePath} ... "
ps aux | grep "${scriptFilePath}" | grep -v grep &> /dev/null && kill -9 $(ps aux | grep "${scriptFilePath}" | grep -v grep | awk '{print $2}')
nohup bash ${scriptFilePath} &> /dev/null &
ps aux | grep "${scriptFilePath}" | grep -v grep &> /dev/null && echo "[ok]" || echo "[fail]"

}

main() {

for line in `cat ${BASEPATH}/list | grep -E -v '^#'`
do

reload ${line}

done

}

main $@
