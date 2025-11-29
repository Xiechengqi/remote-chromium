#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

function check() {

scriptFilePath="$1"
echo -n "check ${scriptFilePath} ... "
ps aux | grep "${scriptFilePath}" | grep -v grep &> /dev/null && echo "[ok]" && ps aux | grep "${scriptFilePath}" | grep -v grep || echo "[fail]"

}

main() {

for line in `cat ${BASEPATH}/list | grep -E -v '^#'`
do

check ${line}

done

}

main $@
