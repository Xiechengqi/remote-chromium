#!/usr/bin/env bash

#
# common shell functions and env
#

# println information
INFO() {
printf -- "\033[44;37m%s\033[0m " "[$(TZ=UTC-8 date "+%Y-%m-%d %H:%M:%S")]"
printf -- "%s" "$1"
printf "\n"
}

# println yellow color information
YELLOW() {
printf -- "\033[44;37m%s\033[0m " "[$(TZ=UTC-8 date "+%Y-%m-%d %H:%M:%S")]"
printf -- "\033[33m%s\033[0m" "$1"
printf "\n"
}

# println error information
ERROR() {
printf -- "\033[41;37m%s\033[0m " "[$(TZ=UTC-8 date "+%Y-%m-%d %H:%M:%S")]"
printf -- "%s" "$1"
printf "\n"
exit 1
}

# exec cmd and print error information
EXEC() {
local cmd="$1"
INFO "${cmd}"
eval ${cmd} 1> /dev/null
if [ $? -ne 0 ]; then
ERROR "Execution command (${cmd}) failed, please check it and try again."
fi
}

SLEEP_INFITY() {
local name="$1"
YELLOW "[${name}] sleep infinity ..." && sleep infinity
}
