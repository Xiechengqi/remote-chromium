#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

if [ "${IF_GOLANG_ON}" = "true" ]
then

uname -m | grep -E 'arm64|aarch64' &> /dev/null && EXEC "cp -f -v /app/golang/go1.25.4.linux-arm64.tar.gz /app/golang/go1.25.4.linux.tar.gz"
INFO "tar zxvf /app/golang/go1.25.4.linux.tar.gz --strip-components 1 -C /app/golang/"
tar zxvf /app/golang/go1.25.4.linux.tar.gz --strip-components 1 -C /app/golang/
INFO "rm -f /app/golang/go1.25.4.linux.tar.gz /app/golang/go1.25.4.linux-arm64.tar.gz"
rm -f /app/golang/go1.25.4.linux.tar.gz /app/golang/go1.25.4.linux-arm64.tar.gz
cat >> ~/.bashrc << EOF

## Golang
# export GOPROXY=https://goproxy.cn
export GO111MODULE=on
export GOPATH=/app/golang/path
export GOBIN=\$GOPATH/bin
export PATH=\$PATH:/app/golang/bin:\$GOBIN

EOF
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
