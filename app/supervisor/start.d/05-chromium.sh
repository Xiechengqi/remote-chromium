#!/usr/bin/env bash
# ============================================================================
# Chromium 浏览器启动脚本
# ============================================================================

source /app/supervisor/start.d/common.sh

# 设置 DISPLAY
export DISPLAY=${CHROMIUM_DISPLAY}

# 等待 X11 Display 就绪
while ! xdpyinfo -display ${DISPLAY} &>/dev/null
do
INFO "Waiting for Chromium X server..."
EXEC "sleep 1"
done

INFO "Starting Chromium..."

# 配置策略以禁用安全警告
EXEC "mkdir -p /etc/chromium/policies/managed"
echo '{"CommandLineFlagSecurityWarningsEnabled": false, "DefaultBrowserSettingEnabled": false}' > /etc/chromium/policies/managed/default_managed_policy.json

# 清理崩溃标记
ls ${CHROMIUM_USER_DATA_DIR}/Default/Preferences &> /dev/null && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ${CHROMIUM_USER_DATA_DIR}/Default/Preferences &> /dev/null

# 构建启动参数
OPTS=""
[ ".${CHROMIUM_LOAD_EXTENSION}" != "." ] && OPTS="--load-extension=${CHROMIUM_LOAD_EXTENSION}"
[ ".${CHROMIUM_PROXY_SERVER}" != "." ] && OPTS="${OPTS} --proxy-server=${CHROMIUM_PROXY_SERVER}"
[ ".${CHROMIUM_START_URLS}" != "." ] && OPTS="${OPTS} $(echo ${CHROMIUM_START_URLS} | sed 's/,/ --new-window /g')"
[ "${CHROMIUM_CLEAN_SINGLETONLOCK}" = "true" ] && rm -f ${CHROMIUM_USER_DATA_DIR}/SingletonLock

for i in {1..3}
do
# 启动 Chromium
set -x
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
EXEC "sleep 10"
done

SLEEP_INFITY $0
