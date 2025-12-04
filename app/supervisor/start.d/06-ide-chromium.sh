#!/usr/bin/env bash
# ============================================================================
# IDE 登陆需要调用 Chromium 浏览器 (DISPLAY :1)
# ============================================================================

source /app/supervisor/start.d/common.sh

# 设置 DISPLAY
export DISPLAY=${IDE_DISPLAY}

# 等待 X11 Display 就绪
while ! xdpyinfo -display ${DISPLAY} &>/dev/null
do
INFO "Waiting for IDE X server..."
EXEC "sleep 1"
done

INFO "Starting IDE Chromium..."

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
--simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT'
EXEC "sleep 10"
done

SLEEP_INFITY $0
