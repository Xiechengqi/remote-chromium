#!/usr/bin/env bash

# "CommandLineFlagSecurityWarningsEnabled": false 可能用于禁用因使用命令行标志（如 --no-sandbox）而显示的安全警告
# "DefaultBrowserSettingEnabled": false 用来管理默认浏览器设置的提示
mkdir -p /etc/chromium/policies/managed && echo '{"CommandLineFlagSecurityWarningsEnabled": false, "DefaultBrowserSettingEnabled": false}' > /etc/chromium/policies/managed/default_managed_policy.json

ls /app/chromium/user-data/Default/Preferences &> /dev/null && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /app/chromium/user-data/Default/Preferences &> /dev/null

[ ".${CHROMIUM_LOAD_EXTENSION}" != "." ] && OPTS="--load-extension=${CHROMIUM_LOAD_EXTENSION}"
[ ".${CHROMIUM_PROXY_SERVER}" != "." ] && OPTS="${OPTS} --proxy-server=${CHROMIUM_PROXY_SERVER}"
[ ".${CHROMIUM_START_URLS}" != "." ] && OPTS="${OPTS} $(echo ${CHROMIUM_START_URLS} | sed 's/,/ --new-window /g')"
[ "${CHROMIUM_CLEAN_SINGLETONLOCK}" = "true" ] && rm -f ${CHROMIUM_USER_DATA_DIR}/SingletonLock
# 隐私
# --incognito \
chromium \
--no-sandbox \
--no-first-run \
--disable-dev-shm-usage \
--disable-popup-blocking \
--disable-infobars \
--disable-gpu \
--start-maximized \
--no-default-browser-check \
--ozone-platform=x11 \
--password-store=basic \
--enable-features=NetworkService,NetworkServiceInProcess,LoadCryptoTokenExtension,PermuteTLSExtensions \
--disable-features=FlashDeprecationWarning,EnablePasswordsAccountStorage,CommandLineFlagSecurityWarningsEnabled \
--enable-blink-features=IdleDetection,Fledge,Parakeet \
--lang=${CHROMIUM_LANG} \
--user-data-dir=${CHROMIUM_USER_DATA_DIR} \
--simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
--remote-debugging-port=${CHROMIUM_REMOTE_DEBUGGING_PORT} ${OPTS}
