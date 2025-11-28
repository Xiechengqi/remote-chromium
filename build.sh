#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

docker buildx build . -t fullnode/remote-chromium-ubuntu && docker push fullnode/remote-chromium-ubuntu:latest
