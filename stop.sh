#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

name="chromium"
docker rm -f ${name}
