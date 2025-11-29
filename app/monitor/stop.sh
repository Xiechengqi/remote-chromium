#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

function stop() {

scriptFilePath="$1"
echo -n "stop ${scriptFilePath} ... "
ps aux | grep "${scriptFilePath}" | grep -v grep &> /dev/null && kill -9 $(ps aux | grep "${scriptFilePath}" | grep -v grep | awk '{print $2}') && echo "[ok]" || echo "[fail]"

}

main() {

for line in `cat ${BASEPATH}/list | grep -E -v '^#'`
do
stop ${line}
done

}

main $@
