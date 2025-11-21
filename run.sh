#!/usr/bin/env bash

BASEPATH=`dirname $(readlink -f ${BASH_SOURCE[0]})` && cd $BASEPATH

name="chromium"
docker rm -f ${name}

## file port
# -p 5000:5000 \
## terminal port
# -p 2222:2222 \
## env
# -e NOVNC_PASSWORD="123123"
# -e TERMINAL_USER="admin"
# -e TERMINAL_PASSWORD="123123"
# -e CHROMIUM_PROXY_SERVER=socks5://192.168.1.15:1080
# -e ALL_PROXY=socks5://192.168.1.15:1080
# -e TERMINAL_RPOXY=socks5://192.168.1.15:1080 \

docker run -itd \
  --restart=always \
  --privileged \
  -p 7900:7900 \
  -v ${PWD}/scripts:/app/scripts \
  -v ${PWD}/user-data:/app/chromium/user-data \
  -e CHROMIUM_CLEAN_SINGLETONLOCK=true \
  --name ${name} fullnode/remote-chromium-ubuntu:latest
